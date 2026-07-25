from django.db import models

from accounts.models import Employee
from config.common.models import SyncableModel
from customers.models import Customer


class ServiceCategory(SyncableModel):
    class Department(models.TextChoices):
        BARBERSHOP = "barbershop", "Barbershop"
        CARWASH = "carwash", "Carwash"

    department = models.CharField(max_length=20, choices=Department.choices)
    name = models.CharField(max_length=120)
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


class Service(SyncableModel):
    class Department(models.TextChoices):
        BARBERSHOP = "barbershop", "Barbershop"
        CARWASH = "carwash", "Carwash"

    department = models.CharField(max_length=20, choices=Department.choices)
    category = models.CharField(max_length=80)
    subcategory = models.CharField(max_length=80, blank=True)
    category_ref = models.ForeignKey(
        ServiceCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="services",
    )
    name = models.CharField(max_length=120)
    duration_minutes = models.PositiveIntegerField(default=30)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    active = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["department", "category", "subcategory", "name"]

    def __str__(self) -> str:
        return self.name


class Appointment(SyncableModel):
    class Department(models.TextChoices):
        BARBERSHOP = "barbershop", "Barbershop"
        CARWASH = "carwash", "Carwash"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Agendado"
        IN_PROGRESS = "in_progress", "Em atendimento"
        COMPLETED = "completed", "Concluído"
        CANCELLED = "cancelled", "Cancelado"
        NO_SHOW = "no_show", "Falta"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        PARTIAL = "partial", "Parcial"
        PAID = "paid", "Pago"

    department = models.CharField(max_length=20, choices=Department.choices)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="appointments")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="appointments")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="appointments")
    scheduled_for = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    walk_in = models.BooleanField(default=False)
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["scheduled_for"]

    def __str__(self) -> str:
        return f"{self.customer.full_name} - {self.service.name}"
