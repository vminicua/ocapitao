from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import StockMovement
from .serializers import StockMovementSerializer


class StockMovementViewSet(SoftDeleteModelViewSet):
    queryset = StockMovement.objects.select_related("product", "created_by").all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["inventory.view", "inventory.manage"],
        "retrieve": ["inventory.view", "inventory.manage"],
        "create": ["inventory.manage"],
        "update": ["inventory.manage"],
        "partial_update": ["inventory.manage"],
        "destroy": ["inventory.manage"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get("department")
        if department:
            queryset = queryset.filter(product__department=department)
        product_id = self.request.query_params.get("product")
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        movement_type = self.request.query_params.get("movement_type")
        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)
        return queryset

    def perform_destroy(self, instance):
        latest_movement = (
            StockMovement.objects.filter(product=instance.product, deleted_at__isnull=True)
            .order_by("-created_at", "-updated_at")
            .first()
        )
        if latest_movement and latest_movement.pk != instance.pk:
            raise ValidationError("Só é permitido anular o movimento mais recente deste artigo.")

        with transaction.atomic():
            product = instance.product
            product.stock_quantity = instance.stock_before
            product.save(update_fields=["stock_quantity", "updated_at"])

            instance.deleted_at = timezone.now()
            instance.sync_status = "pending"
            instance.save(update_fields=["deleted_at", "sync_status", "updated_at"])

# Create your views here.
