from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "preferred_barber", "loyalty_points", "sync_status")
    search_fields = ("full_name", "phone", "email")

# Register your models here.
