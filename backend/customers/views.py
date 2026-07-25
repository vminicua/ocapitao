from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(SoftDeleteModelViewSet):
    queryset = Customer.objects.select_related("preferred_barber", "preferred_barber__user").all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_roles = {
        "list": ["admin", "manager", "barber", "cashier", "washer"],
        "retrieve": ["admin", "manager", "barber", "cashier", "washer"],
        "create": ["admin", "manager", "barber", "cashier", "washer"],
        "update": ["admin", "manager", "barber", "cashier"],
        "partial_update": ["admin", "manager", "barber", "cashier"],
        "destroy": ["admin", "manager"],
    }

# Create your views here.
