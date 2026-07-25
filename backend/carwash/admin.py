from django.contrib import admin

from .models import Vehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ("brand", "model", "customer", "registration_number", "sync_status")
    search_fields = ("brand", "model", "registration_number", "customer__full_name")

# Register your models here.
