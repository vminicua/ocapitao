from django.conf import settings
from django.db.models.signals import m2m_changed, post_save
from django.dispatch import receiver
from config.common.models import SyncStatus

from accounts.models import Employee, Permission, Role
from bar.models import Product, ProductCategory
from barbershop.models import Appointment, Service, ServiceCategory
from carwash.models import Vehicle
from customers.models import Customer, LoyaltyLedger, LoyaltyProgram, Promotion, PromotionRedemption
from inventory.models import PurchaseOrder, PurchaseOrderItem, StockBalance, StockCount, StockCountLine, StockLocation, StockLot, StockMovement, StockTransfer, Supplier
from pos.models import CashMovement, CashSession, Commission, OperationalSession, Payment, Sale, SaleItem
from reports.models import DailySnapshot
from settings_app.models import Settings

from .models import SyncQueue
from .utils import serialize_instance
from .state import sync_signals_suppressed


SYNC_MODELS = (
    Permission,
    Role,
    Employee,
    Customer,
    LoyaltyProgram,
    Promotion,
    PromotionRedemption,
    LoyaltyLedger,
    ServiceCategory,
    Service,
    Appointment,
    ProductCategory,
    Product,
    StockMovement,
    Supplier,
    StockLocation,
    StockBalance,
    PurchaseOrder,
    PurchaseOrderItem,
    StockLot,
    StockCount,
    StockCountLine,
    StockTransfer,
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
    if not settings.SYNC_ENABLED or sync_signals_suppressed():
        return

    action = SyncQueue.Action.UPDATE
    if created is True:
        action = SyncQueue.Action.CREATE
    elif getattr(instance, "deleted_at", None):
        action = SyncQueue.Action.DELETE

    existing = SyncQueue.objects.filter(
        model_label=instance._meta.label,
        object_id=instance.pk,
        status__in=[SyncQueue.Status.PENDING, SyncQueue.Status.CONFLICT, SyncQueue.Status.FAILED],
    ).order_by("created_at").first()
    if existing:
        if existing.action == SyncQueue.Action.CREATE and action == SyncQueue.Action.UPDATE:
            action = SyncQueue.Action.CREATE
        existing.action = action
        existing.payload = serialize_instance(instance)
        if existing.status == SyncQueue.Status.FAILED:
            existing.status = SyncQueue.Status.PENDING
            existing.attempts = 0
        existing.next_attempt_at = None
        if existing.status != SyncQueue.Status.CONFLICT:
            existing.last_error = ""
        existing.save(update_fields=["action", "payload", "status", "attempts", "next_attempt_at", "last_error", "updated_at"])
    else:
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


@receiver(m2m_changed, sender=Promotion.eligible_services.through)
def promotion_services_changed(sender, instance, action, **kwargs):
    if action in {"post_add", "post_remove", "post_clear"}:
        _queue_instance(instance, created=False)
