from django.contrib import admin

from .models import StockMovement


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "movement_type", "quantity", "created_by", "created_at")
    list_filter = ("movement_type",)
    search_fields = ("product__name",)

# Register your models here.
