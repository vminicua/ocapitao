from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import viewsets


class SoftDeleteModelViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        queryset = super().get_queryset()
        model = queryset.model
        if hasattr(model, "deleted_at"):
            if self.request.query_params.get("include_deleted") != "true":
                queryset = queryset.filter(deleted_at__isnull=True)
        sync_since = self.request.query_params.get("sync_since")
        if sync_since and hasattr(model, "updated_at"):
            parsed = parse_datetime(sync_since)
            if parsed:
                queryset = queryset.filter(updated_at__gt=parsed)
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
