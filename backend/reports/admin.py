from django.contrib import admin

from .models import DailySnapshot


@admin.register(DailySnapshot)
class DailySnapshotAdmin(admin.ModelAdmin):
    list_display = ("date", "total_sales", "total_barbershop", "total_bar", "total_carwash", "cash_open")

# Register your models here.
