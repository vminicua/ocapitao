from django.conf import settings
from django.db.models.signals import m2m_changed, post_save
from django.dispatch import receiver

from accounts.models import Employee, Permission, Role
from bar.models import Product, ProductCategory
from barbershop.models import Appointment, Service, ServiceCategory
from carwash.models import Vehicle
from customers.models import Customer
from inventory.models import StockMovement
from pos.models import CashMovement, CashSession, Commission, OperationalSession, Payment, Sale, SaleItem
from reports.models import DailySnapshot
from settings_app.models import Settings

from .models import SyncQueue
from .utils import serialize_instance


SYNC_MODELS = (
    Permission,
    Role,
    Employee,
    Customer,
    ServiceCategory,
    Service,
    Appointment,
    ProductCategory,
    Product,
    StockMovement,
    Vehicle,
    CashSession,
    CashMovement,
    OperationalSession,
    Sale,
    SaleItem,
    Payment,
    Commission,
    DailySnapshot,
    Settings,
)


def _queue_instance(instance, created: bool | None = None):
    if not settings.SYNC_ENABLED:
        return

    action = SyncQueue.Action.UPDATE
    if created is True:
        action = SyncQueue.Action.CREATE
    elif getattr(instance, "deleted_at", None):
        action = SyncQueue.Action.DELETE

    SyncQueue.objects.create(
        model_label=instance._meta.label,
        object_id=instance.pk,
        action=action,
        payload=serialize_instance(instance),
    )


for model in SYNC_MODELS:

    @receiver(post_save, sender=model)
    def syncable_post_save(sender, instance, created, **kwargs):  # type: ignore[misc]
        _queue_instance(instance, created=created)


@receiver(m2m_changed, sender=Role.permissions.through)
def role_permissions_changed(sender, instance, action, **kwargs):
    if action in {"post_add", "post_remove", "post_clear"}:
        _queue_instance(instance, created=False)
