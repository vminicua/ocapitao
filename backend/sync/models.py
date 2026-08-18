from django.db import models

from config.common.models import SyncStatus, TimestampedModel


class SyncQueue(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendente"
        SYNCED = "synced", "Sincronizado"
        CONFLICT = "conflict", "Conflito"
        FAILED = "failed", "Falha permanente"

    class Action(models.TextChoices):
        CREATE = "create", "Criar"
        UPDATE = "update", "Atualizar"
        DELETE = "delete", "Eliminar"

    model_label = models.CharField(max_length=100)
    object_id = models.UUIDField()
    action = models.CharField(max_length=20, choices=Action.choices)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["model_label", "object_id"],
                condition=models.Q(status="pending"),
                name="unique_pending_sync_object",
            )
        ]

    def __str__(self) -> str:
        return f"{self.model_label} - {self.get_action_display()}"


class SyncLog(TimestampedModel):
    class Status(models.TextChoices):
        RUNNING = "running", "Em execução"
        SUCCESS = "success", "Concluída"
        PARTIAL = "partial", "Parcial"
        OFFLINE = "offline", "Offline"
        FAILED = "failed", "Falhou"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RUNNING)
    synced_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    details = models.JSONField(default=dict, blank=True)
    message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_status_display()} - {self.created_at:%d/%m/%Y %H:%M}"


class SyncCursor(models.Model):
    model_label = models.CharField(max_length=100, unique=True)
    last_pulled_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

# Create your models here.
