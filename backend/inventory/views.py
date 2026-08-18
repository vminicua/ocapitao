from django.db import models, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from decimal import Decimal

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import PurchaseOrder, PurchaseOrderItem, StockBalance, StockCount, StockCountLine, StockLocation, StockLot, StockMovement, StockTransfer, Supplier
from .serializers import PurchaseOrderItemSerializer, PurchaseOrderSerializer, StockBalanceSerializer, StockCountLineSerializer, StockCountSerializer, StockLocationSerializer, StockLotSerializer, StockMovementSerializer, StockTransferSerializer, SupplierSerializer


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


class InventoryManageViewSet(SoftDeleteModelViewSet):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"list": ["purchases.view", "purchases.manage"], "retrieve": ["purchases.view", "purchases.manage"], "create": ["purchases.manage"], "update": ["purchases.manage"], "partial_update": ["purchases.manage"], "destroy": ["purchases.manage"]}


class SupplierViewSet(InventoryManageViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer


class StockLocationViewSet(InventoryManageViewSet):
    queryset = StockLocation.objects.all()
    serializer_class = StockLocationSerializer


class StockBalanceViewSet(InventoryManageViewSet):
    queryset = StockBalance.objects.select_related("product", "location").all()
    serializer_class = StockBalanceSerializer


class PurchaseOrderItemViewSet(InventoryManageViewSet):
    queryset = PurchaseOrderItem.objects.select_related("order", "product").all()
    serializer_class = PurchaseOrderItemSerializer


class PurchaseOrderViewSet(InventoryManageViewSet):
    queryset = PurchaseOrder.objects.select_related("supplier", "location").prefetch_related("items__product").all()
    serializer_class = PurchaseOrderSerializer
    allowed_permissions = {**InventoryManageViewSet.allowed_permissions, "receive": ["purchases.manage"]}

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        with transaction.atomic():
            order = PurchaseOrder.objects.select_for_update().get(pk=pk, deleted_at__isnull=True)
            if order.status in [PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.CANCELLED]:
                raise ValidationError("Esta encomenda não pode receber mercadoria.")
            receipts = (request.data or {}).get("items", [])
            if not receipts:
                raise ValidationError({"items": "Informe os artigos recebidos."})
            for receipt in receipts:
                item = PurchaseOrderItem.objects.select_for_update().select_related("product").get(pk=receipt.get("item_id"), order=order)
                quantity = Decimal(str(receipt.get("quantity", "0")))
                if quantity <= 0 or item.quantity_received + quantity > item.quantity_ordered:
                    raise ValidationError({"quantity": f"Quantidade inválida para {item.product.name}."})
                product = item.product.__class__.objects.select_for_update().get(pk=item.product_id)
                before = product.stock_quantity
                new_received = item.quantity_received + quantity
                total_cost = product.cost_price * before + item.unit_cost * quantity
                product.stock_quantity = before + quantity
                product.cost_price = total_cost / product.stock_quantity if product.stock_quantity else item.unit_cost
                product.save(update_fields=["stock_quantity", "cost_price", "updated_at"])
                item.quantity_received = new_received
                item.save(update_fields=["quantity_received", "updated_at"])
                balance, _ = StockBalance.objects.select_for_update().get_or_create(product=product, location=order.location)
                balance.quantity += quantity
                balance.save()
                StockMovement.objects.create(product=product, movement_type=StockMovement.MovementType.ENTRY, reference_type=StockMovement.ReferenceType.PURCHASE, reference_code=order.number, quantity=quantity, unit_cost=item.unit_cost, stock_before=before, stock_after=product.stock_quantity, created_by=request.user)
                lot_number = str(receipt.get("lot_number", "")).strip()
                if lot_number:
                    lot, _ = StockLot.objects.get_or_create(product=product, location=order.location, lot_number=lot_number, defaults={"expiry_date": receipt.get("expiry_date") or None, "unit_cost": item.unit_cost})
                    lot.quantity += quantity
                    lot.save()
            complete = not order.items.filter(quantity_received__lt=models.F("quantity_ordered")).exists()
            order.status = PurchaseOrder.Status.RECEIVED if complete else PurchaseOrder.Status.PARTIAL
            order.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(order).data)


class StockLotViewSet(InventoryManageViewSet):
    queryset = StockLot.objects.select_related("product", "location").all()
    serializer_class = StockLotSerializer


class StockCountLineViewSet(InventoryManageViewSet):
    queryset = StockCountLine.objects.select_related("count", "product").all()
    serializer_class = StockCountLineSerializer
    allowed_permissions = {"list": ["inventory.view", "stock.count"], "retrieve": ["inventory.view", "stock.count"], "create": ["stock.count"], "update": ["stock.count"], "partial_update": ["stock.count"], "destroy": ["stock.count"]}


class StockCountViewSet(InventoryManageViewSet):
    queryset = StockCount.objects.select_related("location").prefetch_related("lines__product").all()
    serializer_class = StockCountSerializer
    allowed_permissions = {"list": ["inventory.view", "stock.count"], "retrieve": ["inventory.view", "stock.count"], "create": ["stock.count"], "update": ["stock.count"], "partial_update": ["stock.count"], "destroy": ["stock.count"], "approve": ["stock.count"]}

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        with transaction.atomic():
            count = StockCount.objects.select_for_update().get(pk=pk, status__in=[StockCount.Status.OPEN, StockCount.Status.SUBMITTED])
            for line in count.lines.select_related("product"):
                balance, _ = StockBalance.objects.select_for_update().get_or_create(product=line.product, location=count.location)
                difference = line.counted_quantity - balance.quantity
                if difference:
                    before = line.product.stock_quantity
                    line.product.stock_quantity += difference
                    line.product.save(update_fields=["stock_quantity", "updated_at"])
                    StockMovement.objects.create(product=line.product, movement_type=StockMovement.MovementType.ADJUSTMENT, reference_type=StockMovement.ReferenceType.ADJUSTMENT, reference_code=str(count.id), quantity=line.product.stock_quantity, stock_before=before, stock_after=line.product.stock_quantity, notes="Aprovação de contagem física", created_by=request.user)
                    balance.quantity = line.counted_quantity
                    balance.save()
            count.status = StockCount.Status.APPROVED
            count.approved_by = request.user
            count.counted_at = timezone.now()
            count.save()
        return Response(self.get_serializer(count).data)


class StockTransferViewSet(InventoryManageViewSet):
    queryset = StockTransfer.objects.select_related("product", "source", "destination").all()
    serializer_class = StockTransferSerializer
    allowed_permissions = {"list": ["inventory.view", "stock.transfer"], "retrieve": ["inventory.view", "stock.transfer"], "create": ["stock.transfer"], "update": ["stock.transfer"], "partial_update": ["stock.transfer"], "destroy": ["stock.transfer"]}

    def perform_create(self, serializer):
        with transaction.atomic():
            product = serializer.validated_data["product"]
            source = serializer.validated_data["source"]
            destination = serializer.validated_data["destination"]
            quantity = serializer.validated_data["quantity"]
            if source == destination or quantity <= 0:
                raise ValidationError("Origem, destino ou quantidade inválida.")
            source_balance = StockBalance.objects.select_for_update().filter(product=product, location=source).first()
            if not source_balance or source_balance.quantity < quantity:
                raise ValidationError("Stock insuficiente na localização de origem.")
            destination_balance, _ = StockBalance.objects.select_for_update().get_or_create(product=product, location=destination)
            source_balance.quantity -= quantity
            destination_balance.quantity += quantity
            source_balance.save(); destination_balance.save()
            serializer.save(transferred_by=self.request.user)

# Create your views here.
