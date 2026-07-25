from django.utils import timezone
from rest_framework import viewsets


class SoftDeleteModelViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        queryset = super().get_queryset()
        model = queryset.model
        if hasattr(model, "deleted_at"):
            return queryset.filter(deleted_at__isnull=True)
        return queryset

    def perform_destroy(self, instance):
        if hasattr(instance, "deleted_at"):
            instance.deleted_at = timezone.now()
            if hasattr(instance, "sync_status"):
                instance.sync_status = "pending"
                instance.save(update_fields=["deleted_at", "sync_status", "updated_at"])
                return
            instance.save(update_fields=["deleted_at", "updated_at"])
            return
        instance.delete()
