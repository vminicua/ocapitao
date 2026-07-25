from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import CashMovement, CashSession, Payment, Sale, SaleItem
from .serializers import (
    CashMovementSerializer,
    CashSessionSerializer,
    PaymentSerializer,
    SaleItemSerializer,
    SaleSerializer,
)


class CashSessionViewSet(SoftDeleteModelViewSet):
    queryset = CashSession.objects.select_related("opened_by", "closed_by").all()
    serializer_class = CashSessionSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
    }


class CashMovementViewSet(SoftDeleteModelViewSet):
    queryset = CashMovement.objects.select_related("session", "created_by").all()
    serializer_class = CashMovementSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
    }


class SaleViewSet(SoftDeleteModelViewSet):
    queryset = Sale.objects.select_related("customer", "vehicle", "seller__user", "session").all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
    }


class SaleItemViewSet(SoftDeleteModelViewSet):
    queryset = SaleItem.objects.select_related("sale", "product", "service").all()
    serializer_class = SaleItemSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
    }

    def perform_destroy(self, instance):
        sale = instance.sale
        super().perform_destroy(instance)
        sale.recalculate_totals()
        sale.save(update_fields=["subtotal", "total_amount", "updated_at"])


class PaymentViewSet(SoftDeleteModelViewSet):
    queryset = Payment.objects.select_related("sale").all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
    }

# Create your views here.
