from django.db import models

from config.common.models import SyncableModel


class DailySnapshot(SyncableModel):
    date = models.DateField(unique=True)
    total_sales = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_barbershop = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_bar = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_carwash = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pending_services = models.PositiveIntegerField(default=0)
    cash_open = models.BooleanField(default=False)

    class Meta:
        ordering = ["-date"]

    def __str__(self) -> str:
        return self.date.strftime("%d/%m/%Y")

# Create your models here.
