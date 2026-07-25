from django.db import models

from config.common.models import SyncableModel


class ProductCategory(SyncableModel):
    class Department(models.TextChoices):
        BAR = "bar", "Bar"
        BARBERSHOP = "barbershop", "Barbershop"
        CARWASH = "carwash", "Carwash"
        SHARED = "shared", "Partilhado"

    name = models.CharField(max_length=100)
    department = models.CharField(max_length=20, choices=Department.choices, default=Department.BAR)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["department", "name"]

    def __str__(self) -> str:
        if self.parent_id:
            return f"{self.parent.name} / {self.name}"
        return self.name


class Product(SyncableModel):
    class Department(models.TextChoices):
        BAR = "bar", "Bar"
        BARBERSHOP = "barbershop", "Barbershop"
        CARWASH = "carwash", "Carwash"
        SHARED = "shared", "Partilhado"

    class ItemType(models.TextChoices):
        RESALE = "resale", "Revenda"
        CONSUMABLE = "consumable", "Consumível"
        SUPPLY = "supply", "Material"

    class Unit(models.TextChoices):
        UNIT = "unit", "Unidade"
        BOTTLE = "bottle", "Garrafa"
        PACK = "pack", "Pacote"
        BOX = "box", "Caixa"
        LITER = "liter", "Litro"
        MILLILITER = "milliliter", "Mililitro"
        KILOGRAM = "kilogram", "Quilograma"

    category = models.ForeignKey(ProductCategory, on_delete=models.PROTECT, related_name="products")
    department = models.CharField(max_length=20, choices=Department.choices, default=Department.BAR)
    item_type = models.CharField(max_length=20, choices=ItemType.choices, default=ItemType.RESALE)
    name = models.CharField(max_length=120)
    sku = models.CharField(max_length=50, unique=True)
    barcode = models.CharField(max_length=80, blank=True)
    unit = models.CharField(max_length=20, choices=Unit.choices, default=Unit.UNIT)
    sale_price = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    low_stock_threshold = models.DecimalField(max_digits=10, decimal_places=2, default=5)
    reorder_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    supplier_name = models.CharField(max_length=120, blank=True)
    storage_location = models.CharField(max_length=120, blank=True)
    image_url = models.TextField(blank=True, default="/branding/placeholders/product-default.svg")
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

# Create your models here.
