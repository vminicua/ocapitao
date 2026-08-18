from dataclasses import dataclass
from datetime import timedelta

import pymysql
import requests
from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from config.common.models import SyncStatus

from .models import SyncCursor, SyncLog, SyncQueue
from .state import suppress_sync_signals


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
    "pos.OperationalSession": "operational-sessions",
    "pos.Sale": "sales",
    "pos.SaleItem": "sale-items",
    "pos.Payment": "payments",
    "pos.Commission": "commissions",
    "reports.DailySnapshot": "daily-snapshots",
    "settings_app.Settings": "settings",
}

API_RELATION_FIELDS = {
    "accounts.Role": {"permissions": "permission_ids"},
    "accounts.Employee": {"user": "user_id"},
    "customers.Customer": {"preferred_barber": "preferred_barber_id"},
    "barbershop.ServiceCategory": {"parent": "parent_id"},
    "barbershop.Service": {"category_ref": "category_ref_id"},
    "barbershop.Appointment": {"customer": "customer_id", "employee": "employee_id", "service": "service_id"},
    "bar.ProductCategory": {"parent": "parent_id"},
    "bar.Product": {"category": "category_id"},
    "inventory.StockMovement": {"product": "product_id", "created_by": "created_by_id"},
    "carwash.Vehicle": {"customer": "customer_id"},
    "pos.CashSession": {"opened_by": "opened_by_id", "closed_by": "closed_by_id"},
    "pos.CashMovement": {"session": "session_id", "created_by": "created_by_id"},
    "pos.OperationalSession": {"customer": "customer_id", "responsible": "responsible_id", "vehicle": "vehicle_id", "appointment": "appointment_id"},
    "pos.Sale": {"session": "session_id", "customer": "customer_id", "vehicle": "vehicle_id", "appointment": "appointment_id", "seller": "seller_id"},
    "pos.SaleItem": {"sale": "sale_id", "product": "product_id", "service": "service_id"},
    "pos.Payment": {"sale": "sale_id"},
    "pos.Commission": {"sale": "sale_id", "employee": "employee_id"},
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

    def request(self, method: str, path: str, payload: dict | None = None):
        return requests.request(
            method=method,
            url=f"{self.base_url}/{path.lstrip('/')}",
            json=payload,
            headers=self.get_headers(),
            timeout=settings.SYNC_REQUEST_TIMEOUT,
        )

    def get_feed(self, since=None):
        suffix = f"?since={since.isoformat()}" if since else ""
        response = self.request("GET", f"sync/feed/{suffix}")
        response.raise_for_status()
        return response.json()


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

        pull_result = self.pull_remote()
        now = timezone.now()
        queue_items = list(
            SyncQueue.objects.filter(status=SyncStatus.PENDING)
            .filter(Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=now))
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
                remote_id = response.json().get("id") if response.content else None
                self._mark_model_as_synced(item, remote_id)
                synced_count += 1
                details.append({"object_id": str(item.object_id), "status": "synced"})
            except requests.RequestException as exc:
                failed_count += 1
                item.status = SyncQueue.Status.FAILED if item.attempts + 1 >= 8 else SyncStatus.PENDING
                item.last_error = str(exc)
                item.attempts += 1
                item.last_attempt_at = timezone.now()
                delay = min(3600, 2 ** min(item.attempts, 10))
                item.next_attempt_at = timezone.now() + timedelta(seconds=delay)
                item.save(update_fields=["status", "last_error", "attempts", "last_attempt_at", "next_attempt_at", "updated_at"])
                details.append({"object_id": str(item.object_id), "status": "failed", "error": str(exc)})

        log.status = SyncLog.Status.SUCCESS if failed_count == 0 else SyncLog.Status.PARTIAL
        log.synced_count = synced_count
        log.failed_count = failed_count
        log.details = {"pull": pull_result, "items": details}
        log.message = "Sincronização concluída."
        log.save(update_fields=["status", "synced_count", "failed_count", "details", "message", "updated_at"])
        return {
            "ok": failed_count == 0,
            "message": log.message,
            "synced_count": synced_count,
            "failed_count": failed_count,
        }

    def _dispatch_item(self, item: SyncQueue, endpoint: str):
        app_label, model_name = item.model_label.split(".")
        model = apps.get_model(app_label, model_name)
        instance = model.objects.filter(pk=item.object_id).first()
        remote_id = getattr(instance, "remote_id", None) if instance else None
        target_id = remote_id or item.object_id
        payload = dict(item.payload)
        for source, target in API_RELATION_FIELDS.get(item.model_label, {}).items():
            if source in payload:
                payload[target] = payload.pop(source)
        if item.action == SyncQueue.Action.CREATE:
            response = self.client.request("POST", f"{endpoint}/", payload)
            if response.status_code >= 400:
                return self.client.request("PATCH", f"{endpoint}/{target_id}/", payload)
            return response
        if item.action == SyncQueue.Action.UPDATE:
            return self.client.request("PATCH", f"{endpoint}/{target_id}/", payload)
        return self.client.request(
            "PATCH",
            f"{endpoint}/{target_id}/",
            {
                "deleted_at": item.payload.get("deleted_at"),
                "sync_status": SyncStatus.SYNCED,
            },
        )

    @transaction.atomic
    def _mark_model_as_synced(self, item: SyncQueue, remote_id=None):
        app_label, model_name = item.model_label.split(".")
        model = apps.get_model(app_label, model_name)
        model.objects.filter(pk=item.object_id).update(
            remote_id=remote_id or item.object_id,
            sync_status=SyncStatus.SYNCED,
            updated_at=timezone.now(),
        )

    def pull_remote(self) -> dict:
        cursor, _ = SyncCursor.objects.get_or_create(model_label="__feed__")
        try:
            feed = self.client.get_feed(cursor.last_pulled_at)
        except requests.RequestException as exc:
            return {"downloaded": 0, "conflicts": 0, "error": str(exc)}

        entries = feed.get("results", [])
        order = {label: index for index, label in enumerate(MODEL_ENDPOINTS)}
        entries.sort(key=lambda entry: (order.get(entry.get("model_label"), 999), entry.get("updated_at", "")))
        downloaded = 0
        conflicts = 0
        skipped = 0
        with transaction.atomic(), suppress_sync_signals():
            for entry in entries:
                model_label = entry.get("model_label")
                if model_label not in MODEL_ENDPOINTS:
                    continue
                object_id = entry.get("object_id")
                pending = SyncQueue.objects.filter(
                    model_label=model_label, object_id=object_id,
                    status__in=[SyncQueue.Status.PENDING, SyncQueue.Status.CONFLICT],
                ).first()
                if pending:
                    ignored = {"sync_status", "updated_at", "created_at", "remote_id"}
                    local_payload = {key: value for key, value in pending.payload.items() if key not in ignored}
                    remote_payload = {key: value for key, value in (entry.get("payload") or {}).items() if key not in ignored}
                    if local_payload == remote_payload:
                        pending.status = SyncQueue.Status.SYNCED
                        pending.last_error = ""
                        pending.save(update_fields=["status", "last_error", "updated_at"])
                        self._mark_model_as_synced(pending, object_id)
                        downloaded += 1
                        continue
                    if pending.status != SyncQueue.Status.CONFLICT:
                        pending.status = SyncStatus.CONFLICT
                        pending.last_error = "O registo foi alterado localmente e na cloud desde a última sincronização."
                        pending.save(update_fields=["status", "last_error", "updated_at"])
                    conflicts += 1
                    continue
                if self._apply_remote_entry(model_label, object_id, entry.get("payload") or {}):
                    downloaded += 1
                else:
                    skipped += 1
            server_time = feed.get("server_time")
            if feed.get("has_more") and entries:
                from django.utils.dateparse import parse_datetime
                last_entry_time = parse_datetime(entries[-1].get("updated_at", ""))
                if last_entry_time:
                    server_time = (last_entry_time - timedelta(microseconds=1)).isoformat()
            if server_time and skipped == 0:
                from django.utils.dateparse import parse_datetime
                cursor.last_pulled_at = parse_datetime(server_time)
                cursor.save(update_fields=["last_pulled_at", "updated_at"])
        return {"downloaded": downloaded, "conflicts": conflicts, "deferred": skipped}

    def _apply_remote_entry(self, model_label: str, object_id: str, payload: dict) -> bool:
        app_label, model_name = model_label.split(".")
        model = apps.get_model(app_label, model_name)
        instance = model.objects.filter(Q(pk=object_id) | Q(remote_id=object_id)).first()
        values = {}
        m2m_values = {}
        for field in model._meta.get_fields():
            if not getattr(field, "concrete", False) and not field.many_to_many:
                continue
            if getattr(field, "primary_key", False) or field.name in {"created_at", "updated_at"}:
                continue
            if field.many_to_many and field.name in payload:
                m2m_values[field.name] = payload[field.name]
                continue
            if not getattr(field, "concrete", False) or field.name not in payload:
                continue
            value = payload[field.name]
            if getattr(field, "is_relation", False) and value:
                related = field.remote_field.model.objects.filter(Q(pk=value) | Q(remote_id=value)).first()
                if not related:
                    return False
                values[field.attname] = related.pk
            else:
                values[field.name] = value
        values["remote_id"] = object_id
        values["sync_status"] = SyncStatus.SYNCED
        if instance:
            for key, value in values.items():
                setattr(instance, key, value)
            instance.save()
        else:
            instance = model.objects.create(**values)
        for field_name, remote_ids in m2m_values.items():
            field = model._meta.get_field(field_name)
            related = field.remote_field.model.objects.filter(Q(pk__in=remote_ids) | Q(remote_id__in=remote_ids))
            getattr(instance, field_name).set(related)
        return True
