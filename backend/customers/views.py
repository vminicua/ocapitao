from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import Customer, LoyaltyLedger, LoyaltyProgram, Promotion, PromotionRedemption
from .serializers import CustomerSerializer, LoyaltyLedgerSerializer, LoyaltyProgramSerializer, PromotionRedemptionSerializer, PromotionSerializer


class CustomerViewSet(SoftDeleteModelViewSet):
    queryset = Customer.objects.select_related("preferred_barber", "preferred_barber__user").all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["customers.view", "customers.manage"], "retrieve": ["customers.view", "customers.manage"],
        "create": ["customers.manage"], "update": ["customers.manage"], "partial_update": ["customers.manage"],
        "destroy": ["customers.manage"],
    }


class LoyaltyManageViewSet(SoftDeleteModelViewSet):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"list": ["loyalty.view", "promotions.view", "promotions.manage", "loyalty.adjust"], "retrieve": ["loyalty.view", "promotions.view", "promotions.manage", "loyalty.adjust"], "create": ["promotions.manage", "loyalty.adjust"], "update": ["promotions.manage", "loyalty.adjust"], "partial_update": ["promotions.manage", "loyalty.adjust"], "destroy": ["promotions.manage", "loyalty.adjust"]}


class LoyaltyProgramViewSet(LoyaltyManageViewSet):
    queryset = LoyaltyProgram.objects.all()
    serializer_class = LoyaltyProgramSerializer
    allowed_permissions = {"list": ["loyalty.view", "loyalty.adjust"], "retrieve": ["loyalty.view", "loyalty.adjust"], "create": ["loyalty.adjust"], "update": ["loyalty.adjust"], "partial_update": ["loyalty.adjust"], "destroy": ["loyalty.adjust"]}


class PromotionViewSet(LoyaltyManageViewSet):
    queryset = Promotion.objects.prefetch_related("eligible_services").all()
    serializer_class = PromotionSerializer
    allowed_permissions = {"list": ["promotions.view", "promotions.manage"], "retrieve": ["promotions.view", "promotions.manage"], "create": ["promotions.manage"], "update": ["promotions.manage"], "partial_update": ["promotions.manage"], "destroy": ["promotions.manage"]}


class PromotionRedemptionViewSet(LoyaltyManageViewSet):
    queryset = PromotionRedemption.objects.select_related("promotion", "customer", "sale").all()
    serializer_class = PromotionRedemptionSerializer
    allowed_permissions = {"list": ["loyalty.view", "promotions.view", "promotions.manage"], "retrieve": ["loyalty.view", "promotions.view", "promotions.manage"], "create": ["loyalty.adjust"], "update": ["loyalty.adjust"], "partial_update": ["loyalty.adjust"], "destroy": ["loyalty.adjust"]}


class LoyaltyLedgerViewSet(LoyaltyManageViewSet):
    queryset = LoyaltyLedger.objects.select_related("customer", "sale").all()
    serializer_class = LoyaltyLedgerSerializer
    allowed_permissions = {"list": ["loyalty.view", "loyalty.adjust"], "retrieve": ["loyalty.view", "loyalty.adjust"], "create": ["loyalty.adjust"], "update": ["loyalty.adjust"], "partial_update": ["loyalty.adjust"], "destroy": ["loyalty.adjust"]}

# Create your views here.
