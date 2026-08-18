from django.db import models

from accounts.models import User
from bar.models import Product
from config.common.models import SyncableModel


class StockMovement(SyncableModel):
    class MovementType(models.TextChoices):
        ENTRY = "entry", "Entrada"
        EXIT = "exit", "Saída"
        ADJUSTMENT = "adjustment", "Ajuste"

    class ReferenceType(models.TextChoices):
        PURCHASE = "purchase", "Compra"
        SALE = "sale", "Venda"
        INTERNAL_USE = "internal_use", "Uso interno"
        LOSS = "loss", "Perda"
        ADJUSTMENT = "adjustment", "Ajuste"
        TRANSFER = "transfer", "Transferência"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_movements")
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    reference_type = models.CharField(max_length=20, choices=ReferenceType.choices, default=ReferenceType.ADJUSTMENT)
    reference_code = models.CharField(max_length=80, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_before = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_after = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_movement_type_display()} - {self.product.name}"

    def calculate_stock_after(self, current_stock):
        if self.movement_type == self.MovementType.ENTRY:
            return current_stock + self.quantity
        if self.movement_type == self.MovementType.EXIT:
            return current_stock - self.quantity
        return self.quantity


class Supplier(SyncableModel):
    name = models.CharField(max_length=150)
    nuit = models.CharField(max_length=30, blank=True)
    contact_name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=25, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]


class StockLocation(SyncableModel):
    name = models.CharField(max_length=100, unique=True)
    department = models.CharField(max_length=20, choices=Product.Department.choices, default=Product.Department.SHARED)
    active = models.BooleanField(default=True)


class StockBalance(SyncableModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="location_balances")
    location = models.ForeignKey(StockLocation, on_delete=models.PROTECT, related_name="balances")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["product", "location"], name="unique_product_location")]


class PurchaseOrder(SyncableModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Rascunho"
        ORDERED = "ordered", "Encomendada"
        PARTIAL = "partial", "Receção parcial"
        RECEIVED = "received", "Recebida"
        CANCELLED = "cancelled", "Cancelada"

    number = models.CharField(max_length=40, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchase_orders")
    location = models.ForeignKey(StockLocation, on_delete=models.PROTECT, related_name="purchase_orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    ordered_at = models.DateTimeField(null=True, blank=True)
    expected_at = models.DateField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-created_at"]


class PurchaseOrderItem(SyncableModel):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="purchase_items")
    quantity_ordered = models.DecimalField(max_digits=10, decimal_places=2)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["order", "product"], name="unique_purchase_product")]


class StockLot(SyncableModel):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="lots")
    location = models.ForeignKey(StockLocation, on_delete=models.PROTECT, related_name="lots")
    lot_number = models.CharField(max_length=80)
    expiry_date = models.DateField(null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["product", "location", "lot_number"], name="unique_stock_lot")]


class StockCount(SyncableModel):
    class Status(models.TextChoices):
        OPEN = "open", "Aberta"
        SUBMITTED = "submitted", "Submetida"
        APPROVED = "approved", "Aprovada"
        CANCELLED = "cancelled", "Cancelada"

    location = models.ForeignKey(StockLocation, on_delete=models.PROTECT, related_name="counts")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    counted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="stock_counts_created")
    approved_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="stock_counts_approved")
    notes = models.TextField(blank=True)


class StockCountLine(SyncableModel):
    count = models.ForeignKey(StockCount, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    expected_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    counted_quantity = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["count", "product"], name="unique_count_product")]


class StockTransfer(SyncableModel):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="transfers")
    source = models.ForeignKey(StockLocation, on_delete=models.PROTECT, related_name="outgoing_transfers")
    destination = models.ForeignKey(StockLocation, on_delete=models.PROTECT, related_name="incoming_transfers")
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    transferred_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    notes = models.TextField(blank=True)

# Create your models here.
