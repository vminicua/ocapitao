from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import Customer, LoyaltyLedger, LoyaltyProgram, Promotion, PromotionRedemption
from .serializers import CustomerSerializer, LoyaltyLedgerSerializer, LoyaltyProgramSerializer, PromotionRedemptionSerializer, PromotionSerializer


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


class LoyaltyManageViewSet(SoftDeleteModelViewSet):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"list": ["reports.view", "settings.manage"], "retrieve": ["reports.view", "settings.manage"], "create": ["settings.manage"], "update": ["settings.manage"], "partial_update": ["settings.manage"], "destroy": ["settings.manage"]}


class LoyaltyProgramViewSet(LoyaltyManageViewSet):
    queryset = LoyaltyProgram.objects.all()
    serializer_class = LoyaltyProgramSerializer


class PromotionViewSet(LoyaltyManageViewSet):
    queryset = Promotion.objects.prefetch_related("eligible_services").all()
    serializer_class = PromotionSerializer


class PromotionRedemptionViewSet(LoyaltyManageViewSet):
    queryset = PromotionRedemption.objects.select_related("promotion", "customer", "sale").all()
    serializer_class = PromotionRedemptionSerializer


class LoyaltyLedgerViewSet(LoyaltyManageViewSet):
    queryset = LoyaltyLedger.objects.select_related("customer", "sale").all()
    serializer_class = LoyaltyLedgerSerializer

# Create your views here.
