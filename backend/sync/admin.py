from django.contrib import admin

from .models import SyncLog, SyncQueue


@admin.register(SyncQueue)
class SyncQueueAdmin(admin.ModelAdmin):
    list_display = ("model_label", "action", "status", "attempts", "last_attempt_at")
    list_filter = ("action", "status")
    search_fields = ("model_label",)


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ("status", "synced_count", "failed_count", "created_at")
    list_filter = ("status",)

# Register your models here.
