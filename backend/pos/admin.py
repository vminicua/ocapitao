from django.contrib import admin

from .models import CashMovement, CashSession, Payment, Sale, SaleItem


@admin.register(CashSession)
class CashSessionAdmin(admin.ModelAdmin):
    list_display = ("opened_at", "opened_by", "status", "opening_amount", "closing_amount")
    list_filter = ("status",)


@admin.register(CashMovement)
class CashMovementAdmin(admin.ModelAdmin):
    list_display = ("session", "movement_type", "amount", "created_by", "created_at")
    list_filter = ("movement_type",)


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("id", "department", "customer", "total_amount", "status", "created_at")
    list_filter = ("department", "status")


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ("sale", "description", "quantity", "unit_price", "total_price")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("sale", "method", "amount", "paid_at")
    list_filter = ("method",)

# Register your models here.
