from django.contrib import admin

from .models import Appointment, Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "department", "category", "price", "active", "sync_status")
    list_filter = ("department", "category", "active")
    search_fields = ("name",)


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("customer", "employee", "service", "scheduled_for", "status", "payment_status")
    list_filter = ("department", "status", "payment_status", "walk_in")
    search_fields = ("customer__full_name", "employee__user__email", "service__name")

# Register your models here.
