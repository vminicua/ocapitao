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


class LoyaltyProgram(SyncableModel):
    name = models.CharField(max_length=120, default="Fidelização O Capitão")
    points_per_currency = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    currency_value_per_point = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    points_expire_days = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)


class Promotion(SyncableModel):
    class RewardType(models.TextChoices):
        FREE_ELIGIBLE_SERVICES = "free_eligible_services", "Serviços elegíveis grátis"
        PERCENTAGE = "percentage", "Desconto percentual"
        FIXED = "fixed", "Desconto fixo"

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    department = models.CharField(max_length=20, choices=[("barbershop", "Barbershop"), ("bar", "Bar"), ("carwash", "Carwash")])
    eligible_services = models.ManyToManyField("barbershop.Service", blank=True, related_name="promotions")
    threshold_count = models.PositiveIntegerField(default=4)
    period = models.CharField(max_length=20, choices=[("calendar_month", "Mês civil")], default="calendar_month")
    reward_type = models.CharField(max_length=40, choices=RewardType.choices, default=RewardType.FREE_ELIGIBLE_SERVICES)
    reward_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_redemptions_per_period = models.PositiveIntegerField(default=0, help_text="Zero significa ilimitado.")
    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]


class PromotionRedemption(SyncableModel):
    promotion = models.ForeignKey(Promotion, on_delete=models.PROTECT, related_name="redemptions")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="promotion_redemptions")
    sale = models.ForeignKey("pos.Sale", on_delete=models.PROTECT, related_name="promotion_redemptions")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    reversed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["promotion", "sale"], name="unique_promotion_sale")]


class LoyaltyLedger(SyncableModel):
    class EntryType(models.TextChoices):
        EARN = "earn", "Ganho"
        REDEEM = "redeem", "Resgate"
        REVERSAL = "reversal", "Estorno"
        ADJUSTMENT = "adjustment", "Ajuste"

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="loyalty_entries")
    sale = models.ForeignKey("pos.Sale", null=True, blank=True, on_delete=models.PROTECT, related_name="loyalty_entries")
    entry_type = models.CharField(max_length=20, choices=EntryType.choices)
    points = models.IntegerField()
    balance_after = models.IntegerField()
    expires_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

# Create your models here.
