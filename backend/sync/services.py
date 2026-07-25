from dataclasses import dataclass

import pymysql
import requests
from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from config.common.models import SyncStatus

from .models import SyncLog, SyncQueue


MODEL_ENDPOINTS = {
    "accounts.Permission": "permissions",
    "accounts.Role": "roles",
    "accounts.Employee": "employees",
    "customers.Customer": "customers",
    "barbershop.ServiceCategory": "service-categories",
    "barbershop.Service": "services",
    "barbershop.Appointment": "appointments",
    "bar.ProductCategory": "product-categories",
    "bar.Product": "products",
    "inventory.StockMovement": "stock-movements",
    "carwash.Vehicle": "vehicles",
    "pos.CashSession": "cash-sessions",
    "pos.CashMovement": "cash-movements",
    "pos.Sale": "sales",
    "pos.SaleItem": "sale-items",
    "pos.Payment": "payments",
    "reports.DailySnapshot": "daily-snapshots",
    "settings_app.Settings": "settings",
}


@dataclass
class RemoteAPIClient:
    base_url: str = settings.REMOTE_API_BASE_URL

    def is_configured(self) -> bool:
        return bool(self.base_url)

    def is_online(self) -> bool:
        if not self.is_configured():
            return False
        try:
            response = requests.get(
                f"{self.base_url}/ping/",
                timeout=settings.SYNC_HEALTH_TIMEOUT,
            )
            return response.ok
        except requests.RequestException:
            return False

    def get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.SYNC_API_EMAIL and settings.SYNC_API_PASSWORD:
            response = requests.post(
                f"{self.base_url}/auth/token/",
                json={
                    "email": settings.SYNC_API_EMAIL,
                    "password": settings.SYNC_API_PASSWORD,
                },
                timeout=settings.SYNC_REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            access_token = response.json()["access"]
            headers["Authorization"] = f"Bearer {access_token}"
        return headers

    def request(self, method: str, path: str, payload: dict):
        return requests.request(
            method=method,
            url=f"{self.base_url}/{path.lstrip('/')}",
            json=payload,
            headers=self.get_headers(),
            timeout=settings.SYNC_REQUEST_TIMEOUT,
        )


class SyncService:
    def __init__(self):
        self.client = RemoteAPIClient()

    def _check_database_connection(self) -> tuple[bool, str]:
        connection = None
        try:
            connection = pymysql.connect(
                host=settings.MYSQL_HOST,
                port=settings.MYSQL_PORT,
                database=settings.MYSQL_DB,
                user=settings.MYSQL_USER,
                password=settings.MYSQL_PASSWORD,
                connect_timeout=settings.SYNC_HEALTH_TIMEOUT,
                charset="utf8mb4",
            )
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            return True, "Ligação MySQL estabelecida com sucesso."
        except Exception as exc:  # noqa: BLE001
            return False, str(exc)
        finally:
            if connection is not None:
                connection.close()

    def status(self) -> dict:
        pending_count = SyncQueue.objects.filter(status=SyncStatus.PENDING).count()

        if not settings.SYNC_ENABLED:
            database_online, database_error = self._check_database_connection()
            return {
                "api_online": True,
                "online": database_online,
                "remote_api_online": True,
                "database_online": database_online,
                "postgres_online": database_online,
                "pending_count": pending_count,
                "mode": "online" if database_online else "offline",
                "label": "API cloud ligada ao MySQL" if database_online else "API cloud sem MySQL",
                "last_error": "" if database_online else database_error,
            }

        remote_api_online = self.client.is_online()
        database_online = False
        database_error = ""

        if remote_api_online:
            database_online, database_error = self._check_database_connection()

        cloud_connected = remote_api_online and database_online

        if cloud_connected:
            label = "Cloud ligada ao MySQL"
            last_error = ""
        elif remote_api_online:
            label = "API cloud ativa, mas MySQL indisponível"
            last_error = database_error or "A API cloud respondeu, mas a base de dados MySQL ainda não ficou pronta."
        else:
            label = "Modo local ativo"
            last_error = "A cloud não está disponível neste momento. A app continua a funcionar localmente."

        return {
            "api_online": True,
            "online": cloud_connected,
            "remote_api_online": remote_api_online,
            "database_online": database_online,
            "postgres_online": database_online,
            "pending_count": pending_count,
            "mode": "online" if cloud_connected else "offline",
            "label": label,
            "last_error": last_error,
        }

    def sync_pending(self) -> dict:
        log = SyncLog.objects.create(status=SyncLog.Status.RUNNING, message="Sincronização iniciada.")
        if not settings.SYNC_ENABLED:
            log.status = SyncLog.Status.FAILED
            log.message = "A sincronização só está ativa no modo local."
            log.save(update_fields=["status", "message", "updated_at"])
            return {"ok": False, "message": log.message}

        if not self.client.is_online():
            log.status = SyncLog.Status.OFFLINE
            log.message = "Sem ligação à API remota."
            log.save(update_fields=["status", "message", "updated_at"])
            return {"ok": False, "message": log.message}

        queue_items = list(
            SyncQueue.objects.filter(status__in=[SyncStatus.PENDING, SyncStatus.CONFLICT])
            .order_by("created_at")[: settings.SYNC_BATCH_SIZE]
        )
        synced_count = 0
        failed_count = 0
        details: list[dict] = []

        for item in queue_items:
            endpoint = MODEL_ENDPOINTS.get(item.model_label)
            if not endpoint:
                failed_count += 1
                item.status = SyncStatus.CONFLICT
                item.last_error = "Modelo sem endpoint configurado."
                item.attempts += 1
                item.last_attempt_at = timezone.now()
                item.save(update_fields=["status", "last_error", "attempts", "last_attempt_at", "updated_at"])
                continue

            try:
                response = self._dispatch_item(item, endpoint)
                response.raise_for_status()
                item.status = SyncStatus.SYNCED
                item.last_error = ""
                item.attempts += 1
                item.last_attempt_at = timezone.now()
                item.save(update_fields=["status", "last_error", "attempts", "last_attempt_at", "updated_at"])
                self._mark_model_as_synced(item)
                synced_count += 1
                details.append({"object_id": str(item.object_id), "status": "synced"})
            except requests.RequestException as exc:
                failed_count += 1
                item.status = SyncStatus.CONFLICT
                item.last_error = str(exc)
                item.attempts += 1
                item.last_attempt_at = timezone.now()
                item.save(update_fields=["status", "last_error", "attempts", "last_attempt_at", "updated_at"])
                details.append({"object_id": str(item.object_id), "status": "failed", "error": str(exc)})

        log.status = SyncLog.Status.SUCCESS if failed_count == 0 else SyncLog.Status.PARTIAL
        log.synced_count = synced_count
        log.failed_count = failed_count
        log.details = {"items": details}
        log.message = "Sincronização concluída."
        log.save(update_fields=["status", "synced_count", "failed_count", "details", "message", "updated_at"])
        return {
            "ok": failed_count == 0,
            "message": log.message,
            "synced_count": synced_count,
            "failed_count": failed_count,
        }

    def _dispatch_item(self, item: SyncQueue, endpoint: str):
        if item.action == SyncQueue.Action.CREATE:
            response = self.client.request("POST", f"{endpoint}/", item.payload)
            if response.status_code >= 400:
                return self.client.request("PATCH", f"{endpoint}/{item.object_id}/", item.payload)
            return response
        if item.action == SyncQueue.Action.UPDATE:
            return self.client.request("PATCH", f"{endpoint}/{item.object_id}/", item.payload)
        return self.client.request(
            "PATCH",
            f"{endpoint}/{item.object_id}/",
            {
                "deleted_at": item.payload.get("deleted_at"),
                "sync_status": SyncStatus.SYNCED,
            },
        )

    @transaction.atomic
    def _mark_model_as_synced(self, item: SyncQueue):
        app_label, model_name = item.model_label.split(".")
        model = apps.get_model(app_label, model_name)
        model.objects.filter(pk=item.object_id).update(
            remote_id=item.object_id,
            sync_status=SyncStatus.SYNCED,
            updated_at=timezone.now(),
        )
