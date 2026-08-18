from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from config.cloud_manager import CloudManager
from config.common.permissions import RoleBasedPermission

from .models import SyncLog, SyncQueue
from .serializers import SyncLogSerializer, SyncQueueSerializer
from .services import MODEL_ENDPOINTS, SyncService
from .utils import serialize_instance
from .backup import BackupService
from django.apps import apps
from django.utils.dateparse import parse_datetime
from django.utils import timezone


class PingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "status": "ok",
                "mensagem": "API O Capitão operacional.",
                "api_online": True,
            }
        )


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        status_data = SyncService().status()
        has_credentials = bool(CloudManager.get()._load_credentials())
        return Response(
            {
                "status": "ok",
                "mensagem": "API O Capitão operacional.",
                "api_online": True,
                "has_cloud_credentials": has_credentials,
                **status_data,
            }
        )


class SyncStatusView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"get": ["sync.manage"]}

    def get(self, request):
        return Response(
            {
                "api_online": True,
                **SyncService().status(),
            }
        )


class SyncNowView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"post": ["sync.manage"]}

    def post(self, request):
        result = SyncService().sync_pending()
        return Response(result, status=status.HTTP_200_OK if result["ok"] else status.HTTP_503_SERVICE_UNAVAILABLE)


class SyncFeedView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"get": ["sync.manage"]}

    def get(self, request):
        since = parse_datetime(request.query_params.get("since", ""))
        entries = []
        for model_label in MODEL_ENDPOINTS:
            app_label, model_name = model_label.split(".")
            model = apps.get_model(app_label, model_name)
            queryset = model.objects.all()
            if since:
                queryset = queryset.filter(updated_at__gt=since)
            for instance in queryset.order_by("updated_at")[:500]:
                entries.append({
                    "model_label": model_label,
                    "object_id": str(instance.pk),
                    "updated_at": instance.updated_at.isoformat(),
                    "payload": serialize_instance(instance),
                })
        entries.sort(key=lambda entry: entry["updated_at"])
        return Response({"results": entries[:1000], "has_more": len(entries) > 1000, "server_time": timezone.now().isoformat()})


class BackupView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"get": ["settings.manage"], "post": ["settings.manage"]}

    def get(self, request):
        return Response({"results": BackupService().list()})

    def post(self, request):
        try:
            return Response(BackupService().create(reason="manual"), status=status.HTTP_201_CREATED)
        except (OSError, RuntimeError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class BackupRestoreView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"post": ["settings.manage"]}

    def post(self, request):
        try:
            return Response(BackupService().restore((request.data or {}).get("file", "")))
        except (OSError, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class CloudConnectView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"post": ["settings.manage"]}

    def post(self, request):
        ssh_password = (request.data or {}).get("ssh_password", "")
        if not ssh_password:
            return Response({"ok": False, "message": "Password SSH não fornecida."})
        ok, message = CloudManager.get().connect(ssh_password)
        return Response({"ok": ok, "message": message})


class CloudDisconnectView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"post": ["settings.manage"]}

    def post(self, request):
        CloudManager.get().disconnect()
        return Response({"ok": True, "message": "Cloud desligada."})


class SyncQueueViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SyncQueue.objects.all()
    serializer_class = SyncQueueSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"*": ["sync.manage"]}

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        item = self.get_object()
        resolution = (request.data or {}).get("resolution")
        if resolution == "keep_local":
            item.status = SyncQueue.Status.PENDING
            item.attempts = 0
            item.next_attempt_at = None
            item.last_error = ""
            item.save(update_fields=["status", "attempts", "next_attempt_at", "last_error", "updated_at"])
        elif resolution == "use_cloud":
            from .models import SyncCursor
            item.delete()
            SyncCursor.objects.filter(model_label="__feed__").update(last_pulled_at=None)
            SyncService().pull_remote()
        else:
            return Response({"detail": "Escolha keep_local ou use_cloud."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"ok": True, "resolution": resolution})


class SyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SyncLog.objects.all()
    serializer_class = SyncLogSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"*": ["sync.manage"]}

# Create your views here.
