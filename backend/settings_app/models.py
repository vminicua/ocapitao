from django.db import models

from config.common.models import SyncableModel


class Settings(SyncableModel):
    business_name = models.CharField(max_length=120, default="O Capitão")
    legal_name = models.CharField(max_length=120, blank=True)
    nuit = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, default="Moçambique")
    phone = models.CharField(max_length=25, blank=True)
    email = models.EmailField(blank=True)
    currency_code = models.CharField(max_length=10, default="MZN")
    currency_symbol = models.CharField(max_length=10, default="MT")
    timezone = models.CharField(max_length=60, default="Africa/Maputo")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=16)
    appointment_slot_minutes = models.PositiveIntegerField(default=30)
    receipt_header = models.TextField(blank=True)
    receipt_footer = models.TextField(blank=True)
    printer_name = models.CharField(max_length=120, blank=True)
    business_hours = models.TextField(blank=True)
    backup_folder = models.CharField(max_length=255, blank=True)
    ssh_tunnel_command = models.TextField(
        blank=True,
        default="ssh -L 5523:127.0.0.1:3306 salacsth@premium342.web-hosting.com -p 21098 -N",
    )
    sync_interval_seconds = models.PositiveIntegerField(default=300)
    auto_sync_enabled = models.BooleanField(default=True)
    enable_barbershop_module = models.BooleanField(default=True)
    enable_bar_module = models.BooleanField(default=True)
    enable_carwash_module = models.BooleanField(default=True)
    enable_pos_module = models.BooleanField(default=True)
    enable_reports_module = models.BooleanField(default=True)
    allow_walk_in = models.BooleanField(default=True)
    enable_low_stock_alerts = models.BooleanField(default=True)
    allow_negative_stock = models.BooleanField(default=False)
    require_pin_on_sale = models.BooleanField(default=True)
    default_markup_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    default_commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    dark_mode = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Configuração"
        verbose_name_plural = "Configurações"

    def __str__(self) -> str:
        return self.business_name

# Create your models here.
