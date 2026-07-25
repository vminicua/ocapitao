from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import Settings
from .serializers import SettingsSerializer


class SettingsViewSet(SoftDeleteModelViewSet):
    queryset = Settings.objects.all()
    serializer_class = SettingsSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["settings.view", "settings.manage"],
        "retrieve": ["settings.view", "settings.manage"],
        "create": ["settings.manage"],
        "update": ["settings.manage"],
        "partial_update": ["settings.manage"],
        "destroy": ["settings.manage"],
    }

# Create your views here.
