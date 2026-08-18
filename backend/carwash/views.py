from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import Vehicle
from .serializers import VehicleSerializer


class VehicleViewSet(SoftDeleteModelViewSet):
    queryset = Vehicle.objects.select_related("customer").all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["vehicles.view", "vehicles.manage"], "retrieve": ["vehicles.view", "vehicles.manage"],
        "create": ["vehicles.manage"], "update": ["vehicles.manage"], "partial_update": ["vehicles.manage"],
        "destroy": ["vehicles.manage"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        customer = self.request.query_params.get("customer")
        search = self.request.query_params.get("search")
        if customer:
            queryset = queryset.filter(customer_id=customer)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(registration_number__icontains=search) | Q(customer__full_name__icontains=search) | Q(customer__phone__icontains=search)
            )
        return queryset

# Create your views here.
