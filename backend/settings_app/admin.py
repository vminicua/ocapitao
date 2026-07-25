from django.contrib import admin

from .models import Settings


@admin.register(Settings)
class SettingsAdmin(admin.ModelAdmin):
    list_display = ("business_name", "phone", "sync_interval_seconds", "dark_mode")

# Register your models here.
