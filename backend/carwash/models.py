from django.db import models

from config.common.models import SyncableModel
from customers.models import Customer


class Vehicle(SyncableModel):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="vehicles")
    registration_number = models.CharField(max_length=20, blank=True)
    brand = models.CharField(max_length=80)
    model = models.CharField(max_length=80)
    color = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["brand", "model"]

    def __str__(self) -> str:
        return f"{self.brand} {self.model}"

# Create your models here.
