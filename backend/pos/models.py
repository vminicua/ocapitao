from decimal import Decimal

from django.db import models

from accounts.models import Employee, User
from bar.models import Product
from barbershop.models import Appointment, Service
from carwash.models import Vehicle
from config.common.models import SyncableModel
from customers.models import Customer


class CashSession(SyncableModel):
    class Status(models.TextChoices):
        OPEN = "open", "Aberto"
        CLOSED = "closed", "Fechado"

    opened_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="opened_sessions")
    closed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="closed_sessions",
    )
    opened_at = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)
    opening_amount = models.DecimalField(max_digits=10, decimal_places=2)
    closing_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expected_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-opened_at"]

    def __str__(self) -> str:
        return f"Caixa {self.opened_at:%d/%m/%Y %H:%M}"


class OperationalSession(SyncableModel):
    """Persistent open order used by tables, chairs and vehicles."""

    class Department(models.TextChoices):
        BARBERSHOP = "barbershop", "Barbershop"
        BAR = "bar", "Bar"
        CARWASH = "carwash", "Carwash"

    class Status(models.TextChoices):
        OPEN = "open", "Aberta"
        WAITING = "waiting", "Aguardando"
        IN_PROGRESS = "in_progress", "Em atendimento"
        PAUSED = "paused", "Pausada"
        READY = "ready", "Pronta"
        AWAITING_PAYMENT = "awaiting_payment", "Aguardando pagamento"
        COMPLETED = "completed", "Concluída"
        CANCELLED = "cancelled", "Cancelada"

    department = models.CharField(max_length=20, choices=Department.choices)
    label = models.CharField(max_length=80)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="operational_sessions")
    responsible = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL, related_name="operational_sessions")
    vehicle = models.ForeignKey(Vehicle, null=True, blank=True, on_delete=models.SET_NULL, related_name="operational_sessions")
    appointment = models.ForeignKey(Appointment, null=True, blank=True, on_delete=models.SET_NULL, related_name="operational_sessions")
    client_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=25, blank=True)
    vehicle_plate = models.CharField(max_length=20, blank=True)
    items = models.JSONField(default=list, blank=True)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    paused_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.get_department_display()} - {self.label}"


class CashMovement(SyncableModel):
    class MovementType(models.TextChoices):
        OPENING = "opening", "Abertura"
        WITHDRAWAL = "withdrawal", "Sangria"
        REINFORCEMENT = "reinforcement", "Reforço"
        ADJUSTMENT = "adjustment", "Ajuste"

    session = models.ForeignKey(CashSession, on_delete=models.CASCADE, related_name="movements")
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_movement_type_display()} - {self.amount}"


class Sale(SyncableModel):
    class Department(models.TextChoices):
        BARBERSHOP = "barbershop", "Barbershop"
        BAR = "bar", "Bar"
        CARWASH = "carwash", "Carwash"

    class Status(models.TextChoices):
        DRAFT = "draft", "Em rascunho"
        COMPLETED = "completed", "Concluída"
        CANCELLED = "cancelled", "Cancelada"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        PARTIAL = "partial", "Parcial"
        PAID = "paid", "Pago"

    session = models.ForeignKey(CashSession, null=True, blank=True, on_delete=models.SET_NULL, related_name="sales")
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="sales")
    vehicle = models.ForeignKey(Vehicle, null=True, blank=True, on_delete=models.SET_NULL, related_name="sales")
    appointment = models.ForeignKey(
        Appointment,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sales",
    )
    seller = models.ForeignKey(Employee, null=True, blank=True, on_delete=models.SET_NULL, related_name="sales")
    department = models.CharField(max_length=20, choices=Department.choices)
    label = models.CharField(max_length=150, blank=True)
    customer_name = models.CharField(max_length=150, blank=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def recalculate_totals(self):
        subtotal = sum(item.total_price for item in self.items.all())
        self.subtotal = subtotal
        self.total_amount = max(Decimal("0.00"), subtotal - self.discount_amount)

    def __str__(self) -> str:
        return f"Venda {self.id}"


class SaleItem(SyncableModel):
    class ItemType(models.TextChoices):
        PRODUCT = "product", "Produto"
        SERVICE = "service", "Serviço"

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    item_type = models.CharField(max_length=20, choices=ItemType.choices)
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.SET_NULL, related_name="sale_items")
    service = models.ForeignKey(Service, null=True, blank=True, on_delete=models.SET_NULL, related_name="sale_items")
    description = models.CharField(max_length=150)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        ordering = ["created_at"]

    def save(self, *args, **kwargs):
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.description


class Payment(SyncableModel):
    class Method(models.TextChoices):
        CASH = "cash", "Dinheiro"
        CARD = "card", "Cartão"
        MPESA = "mpesa", "M-Pesa"
        TRANSFER = "transfer", "Transferência"
        OTHER = "other", "Outro"

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="payments")
    method = models.CharField(max_length=20, choices=Method.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_at = models.DateTimeField()
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-paid_at"]

    def __str__(self) -> str:
        return f"{self.get_method_display()} - {self.amount}"


class Commission(SyncableModel):
    class Status(models.TextChoices):
        ACCRUED = "accrued", "Acumulada"
        PAID = "paid", "Paga"
        REVERSED = "reversed", "Estornada"

    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="commissions")
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="commissions")
    basis_amount = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=5, decimal_places=2)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACCRUED)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

# Create your models here.
