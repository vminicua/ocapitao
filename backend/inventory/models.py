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

# Create your models here.
