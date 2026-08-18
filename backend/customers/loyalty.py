from datetime import timedelta
from decimal import Decimal, ROUND_DOWN

from django.db import models
from django.db.models import Sum
from django.utils import timezone

from .models import Customer, LoyaltyLedger, LoyaltyProgram, Promotion, PromotionRedemption


def best_promotion_for_sale(sale):
    if not sale.customer_id:
        return None, Decimal("0")
    today = timezone.localdate()
    promotions = Promotion.objects.filter(active=True, department=sale.department, deleted_at__isnull=True).filter(
        models.Q(starts_on__isnull=True) | models.Q(starts_on__lte=today),
        models.Q(ends_on__isnull=True) | models.Q(ends_on__gte=today),
    ).prefetch_related("eligible_services")
    period_start = today.replace(day=1)
    next_month = (period_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    best = (None, Decimal("0"))
    for promotion in promotions:
        eligible_ids = list(promotion.eligible_services.values_list("id", flat=True))
        current_items = sale.items.filter(service_id__in=eligible_ids, deleted_at__isnull=True)
        eligible_total = current_items.aggregate(total=Sum("total_price"))["total"] or Decimal("0")
        if eligible_total <= 0:
            continue
        previous_count = sale.items.model.objects.filter(
            sale__customer_id=sale.customer_id,
            sale__status="completed",
            sale__payment_status="paid",
            sale__created_at__date__gte=period_start,
            sale__created_at__date__lt=next_month,
            service_id__in=eligible_ids,
            deleted_at__isnull=True,
        ).exclude(sale=sale).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
        if previous_count < promotion.threshold_count:
            continue
        redemptions = promotion.redemptions.filter(customer_id=sale.customer_id, sale__created_at__date__gte=period_start, sale__created_at__date__lt=next_month, reversed_at__isnull=True).count()
        if promotion.max_redemptions_per_period and redemptions >= promotion.max_redemptions_per_period:
            continue
        if promotion.reward_type == Promotion.RewardType.FREE_ELIGIBLE_SERVICES:
            discount = eligible_total
        elif promotion.reward_type == Promotion.RewardType.PERCENTAGE:
            discount = eligible_total * promotion.reward_value / Decimal("100")
        else:
            discount = min(eligible_total, promotion.reward_value)
        discount = discount.quantize(Decimal("0.01"))
        if discount > best[1]:
            best = (promotion, discount)
    return best


def record_promotion(sale, promotion, discount):
    if promotion and discount > 0:
        PromotionRedemption.objects.create(promotion=promotion, customer=sale.customer, sale=sale, discount_amount=discount)


def accrue_points(sale):
    if not sale.customer_id or sale.payment_status != "paid" or sale.loyalty_entries.filter(entry_type=LoyaltyLedger.EntryType.EARN).exists():
        return
    program = LoyaltyProgram.objects.filter(active=True, deleted_at__isnull=True).first()
    if not program or program.points_per_currency <= 0:
        return
    customer = Customer.objects.select_for_update().get(pk=sale.customer_id)
    points = int((sale.total_amount * program.points_per_currency).to_integral_value(rounding=ROUND_DOWN))
    if points <= 0:
        return
    customer.loyalty_points += points
    customer.save(update_fields=["loyalty_points", "updated_at"])
    expires_at = timezone.now() + timedelta(days=program.points_expire_days) if program.points_expire_days else None
    LoyaltyLedger.objects.create(customer=customer, sale=sale, entry_type=LoyaltyLedger.EntryType.EARN, points=points, balance_after=customer.loyalty_points, expires_at=expires_at, notes="Pontos ganhos pela venda")


def reverse_loyalty_and_promotions(sale):
    sale.promotion_redemptions.filter(reversed_at__isnull=True).update(reversed_at=timezone.now(), updated_at=timezone.now())
    if not sale.customer_id:
        return
    earned = sale.loyalty_entries.filter(entry_type=LoyaltyLedger.EntryType.EARN).aggregate(total=Sum("points"))["total"] or 0
    if not earned or sale.loyalty_entries.filter(entry_type=LoyaltyLedger.EntryType.REVERSAL).exists():
        return
    customer = Customer.objects.select_for_update().get(pk=sale.customer_id)
    removed = min(customer.loyalty_points, earned)
    customer.loyalty_points -= removed
    customer.save(update_fields=["loyalty_points", "updated_at"])
    LoyaltyLedger.objects.create(customer=customer, sale=sale, entry_type=LoyaltyLedger.EntryType.REVERSAL, points=-removed, balance_after=customer.loyalty_points, notes="Estorno por cancelamento da venda")
