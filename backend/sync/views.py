from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.cloud_manager import CloudManager
from config.common.permissions import RoleBasedPermission

from .models import SyncLog, SyncQueue
from .serializers import SyncLogSerializer, SyncQueueSerializer
from .services import SyncService


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


class SyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SyncLog.objects.all()
    serializer_class = SyncLogSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"*": ["sync.manage"]}

# Create your views here.
