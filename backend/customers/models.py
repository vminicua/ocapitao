from django.db import models

from accounts.models import Employee
from config.common.models import SyncableModel


class Customer(SyncableModel):
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=25)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    preferred_barber = models.ForeignKey(
        Employee,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="preferred_customers",
    )
    loyalty_points = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self) -> str:
        return self.full_name

# Create your models here.
