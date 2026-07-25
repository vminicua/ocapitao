from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import Vehicle
from .serializers import VehicleSerializer


class VehicleViewSet(SoftDeleteModelViewSet):
    queryset = Vehicle.objects.select_related("customer").all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_roles = {
        "list": ["admin", "manager", "washer", "cashier"],
        "retrieve": ["admin", "manager", "washer", "cashier"],
        "create": ["admin", "manager", "washer", "cashier"],
        "update": ["admin", "manager", "washer", "cashier"],
        "partial_update": ["admin", "manager", "washer", "cashier"],
        "destroy": ["admin", "manager"],
    }

# Create your views here.
