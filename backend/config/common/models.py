import uuid

from django.db import models


class SyncStatus(models.TextChoices):
    PENDING = "pending", "Pendente"
    SYNCED = "synced", "Sincronizado"
    CONFLICT = "conflict", "Conflito"


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SyncableModel(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    remote_id = models.UUIDField(null=True, blank=True, unique=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    sync_status = models.CharField(
        max_length=20,
        choices=SyncStatus.choices,
        default=SyncStatus.PENDING,
    )

    class Meta:
        abstract = True

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
