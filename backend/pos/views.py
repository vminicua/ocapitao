from decimal import Decimal

from django.db import models, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import CashMovement, CashSession, Commission, OperationalSession, Payment, Sale, SaleItem
from inventory.models import StockMovement
from .serializers import (
    CashMovementSerializer,
    CashSessionSerializer,
    CompleteSaleSerializer,
    CommissionSerializer,
    OperationalSessionSerializer,
    PaymentSerializer,
    SaleItemSerializer,
    SaleSerializer,
)


class OperationalSessionViewSet(SoftDeleteModelViewSet):
    queryset = OperationalSession.objects.select_related("created_by").all()
    serializer_class = OperationalSessionSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"list": ["pos.view", "pos.manage"], "retrieve": ["pos.view", "pos.manage"], "create": ["pos.manage"], "update": ["pos.manage"], "partial_update": ["pos.manage"], "destroy": ["pos.manage"], "snapshot": ["pos.manage"], "transition": ["pos.manage"]}

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get("department")
        status_value = self.request.query_params.get("status")
        if department:
            queryset = queryset.filter(department=department)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    @action(detail=False, methods=["post"])
    def snapshot(self, request):
        department = (request.data or {}).get("department")
        sessions = (request.data or {}).get("sessions")
        valid_departments = {choice for choice, _ in OperationalSession.Department.choices}
        if department not in valid_departments or not isinstance(sessions, list):
            raise ValidationError("Departamento ou lista de sessões inválida.")
        received_ids = []
        with transaction.atomic():
            for payload in sessions:
                serializer = self.get_serializer(data={**payload, "department": department})
                serializer.is_valid(raise_exception=True)
                session_id = serializer.validated_data.get("id")
                instance = OperationalSession.objects.filter(pk=session_id).first() if session_id else None
                if instance:
                    serializer = self.get_serializer(instance, data=payload, partial=True)
                    serializer.is_valid(raise_exception=True)
                    instance = serializer.save()
                else:
                    instance = serializer.save()
                received_ids.append(instance.id)
            OperationalSession.objects.filter(
                department=department, status=OperationalSession.Status.OPEN, deleted_at__isnull=True
            ).exclude(id__in=received_ids).update(status=OperationalSession.Status.CANCELLED)
        queryset = self.get_queryset().filter(department=department, status=OperationalSession.Status.OPEN)
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        target = (request.data or {}).get("status")
        transitions = {
            OperationalSession.Status.OPEN: {OperationalSession.Status.WAITING, OperationalSession.Status.IN_PROGRESS, OperationalSession.Status.CANCELLED},
            OperationalSession.Status.WAITING: {OperationalSession.Status.IN_PROGRESS, OperationalSession.Status.CANCELLED},
            OperationalSession.Status.IN_PROGRESS: {OperationalSession.Status.PAUSED, OperationalSession.Status.READY, OperationalSession.Status.AWAITING_PAYMENT, OperationalSession.Status.CANCELLED},
            OperationalSession.Status.PAUSED: {OperationalSession.Status.IN_PROGRESS, OperationalSession.Status.CANCELLED},
            OperationalSession.Status.READY: {OperationalSession.Status.AWAITING_PAYMENT, OperationalSession.Status.COMPLETED},
            OperationalSession.Status.AWAITING_PAYMENT: {OperationalSession.Status.COMPLETED},
        }
        with transaction.atomic():
            session = OperationalSession.objects.select_for_update().get(pk=pk, deleted_at__isnull=True)
            if target not in transitions.get(session.status, set()):
                raise ValidationError("Transição de estado inválida.")
            session.status = target
            now = timezone.now()
            if target == OperationalSession.Status.IN_PROGRESS:
                session.started_at = session.started_at or now
                session.paused_at = None
            elif target == OperationalSession.Status.PAUSED:
                session.paused_at = now
            elif target == OperationalSession.Status.COMPLETED:
                session.completed_at = now
            session.save()
        return Response(self.get_serializer(session).data)


class CashSessionViewSet(SoftDeleteModelViewSet):
    queryset = CashSession.objects.select_related("opened_by", "closed_by").all()
    serializer_class = CashSessionSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
        "current": ["pos.view", "pos.manage"],
        "open": ["pos.manage"],
        "close": ["pos.manage"],
    }

    @action(detail=False, methods=["get"])
    def current(self, request):
        session = self.get_queryset().filter(status=CashSession.Status.OPEN).first()
        if not session:
            return Response(None)
        return Response(self.get_serializer(session).data)

    @action(detail=False, methods=["post"])
    def open(self, request):
        with transaction.atomic():
            if CashSession.objects.select_for_update().filter(status=CashSession.Status.OPEN, deleted_at__isnull=True).exists():
                return Response({"detail": "Já existe um caixa aberto."}, status=status.HTTP_400_BAD_REQUEST)
            opening_amount = Decimal(str((request.data or {}).get("opening_amount", "0")))
            if opening_amount < 0:
                return Response({"detail": "O fundo inicial não pode ser negativo."}, status=status.HTTP_400_BAD_REQUEST)
            session = CashSession.objects.create(
                opened_by=request.user,
                opened_at=timezone.now(),
                opening_amount=opening_amount,
                expected_amount=opening_amount,
                notes=(request.data or {}).get("notes", ""),
            )
            CashMovement.objects.create(
                session=session,
                movement_type=CashMovement.MovementType.OPENING,
                amount=opening_amount,
                created_by=request.user,
            )
        return Response(self.get_serializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        with transaction.atomic():
            session = CashSession.objects.select_for_update().get(pk=pk, status=CashSession.Status.OPEN)
            cash_sales = Payment.objects.filter(
                sale__session=session,
                sale__status=Sale.Status.COMPLETED,
                method=Payment.Method.CASH,
                deleted_at__isnull=True,
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
            reinforcements = session.movements.filter(
                movement_type=CashMovement.MovementType.REINFORCEMENT,
                deleted_at__isnull=True,
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
            withdrawals = session.movements.filter(
                movement_type=CashMovement.MovementType.WITHDRAWAL,
                deleted_at__isnull=True,
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")
            expected = session.opening_amount + cash_sales + reinforcements - withdrawals
            closing_amount = Decimal(str((request.data or {}).get("closing_amount", "0")))
            session.expected_amount = expected
            session.closing_amount = closing_amount
            session.closed_by = request.user
            session.closed_at = timezone.now()
            session.status = CashSession.Status.CLOSED
            session.notes = (request.data or {}).get("notes", session.notes)
            session.save()
        return Response(self.get_serializer(session).data)


class CashMovementViewSet(SoftDeleteModelViewSet):
    queryset = CashMovement.objects.select_related("session", "created_by").all()
    serializer_class = CashMovementSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
    }


class SaleViewSet(SoftDeleteModelViewSet):
    queryset = Sale.objects.select_related("customer", "vehicle", "seller__user", "session").all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
        "complete": ["pos.manage"],
        "receive_payment": ["pos.manage"],
        "cancel": ["sales.cancel"],
        "receipt": ["pos.view", "pos.manage"],
    }

    def get_queryset(self):
        queryset = super().get_queryset().prefetch_related("items", "payments")
        status_value = self.request.query_params.get("status")
        department = self.request.query_params.get("department")
        if status_value:
            queryset = queryset.filter(status=status_value)
        if department:
            queryset = queryset.filter(department=department)
        return queryset

    @action(detail=False, methods=["post"])
    def complete(self, request):
        serializer = CompleteSaleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        return Response(self.get_serializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="receive-payment")
    def receive_payment(self, request, pk=None):
        with transaction.atomic():
            sale = Sale.objects.select_for_update().get(pk=pk, deleted_at__isnull=True)
            if sale.status != Sale.Status.COMPLETED or sale.balance_due <= 0:
                raise ValidationError("Esta venda não possui dívida pendente.")
            if not CashSession.objects.filter(pk=sale.session_id, status=CashSession.Status.OPEN).exists():
                raise ValidationError("O caixa associado à venda já não está aberto.")
            method = (request.data or {}).get("method")
            valid_methods = {choice for choice, _ in Payment.Method.choices}
            if method not in valid_methods:
                raise ValidationError({"method": "Método de pagamento inválido."})
            amount = sale.balance_due
            Payment.objects.create(sale=sale, method=method, amount=amount, paid_at=timezone.now())
            sale.amount_paid += amount
            sale.balance_due = Decimal("0.00")
            sale.payment_status = Sale.PaymentStatus.PAID
            sale.save(update_fields=["amount_paid", "balance_due", "payment_status", "updated_at"])
            from customers.loyalty import accrue_points
            accrue_points(sale)
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            sale = Sale.objects.select_for_update().prefetch_related("items").get(
                pk=pk, deleted_at__isnull=True
            )
            if sale.status != Sale.Status.COMPLETED:
                raise ValidationError("A venda já foi cancelada ou ainda não foi concluída.")
            for item in sale.items.all():
                if not item.product_id:
                    continue
                product = item.product.__class__.objects.select_for_update().get(pk=item.product_id)
                stock_before = product.stock_quantity
                product.stock_quantity = stock_before + item.quantity
                product.save(update_fields=["stock_quantity", "updated_at"])
                StockMovement.objects.create(
                    product=product,
                    movement_type=StockMovement.MovementType.ENTRY,
                    reference_type=StockMovement.ReferenceType.SALE,
                    reference_code=str(sale.id),
                    quantity=item.quantity,
                    unit_cost=product.cost_price,
                    stock_before=stock_before,
                    stock_after=product.stock_quantity,
                    notes="Reposição por cancelamento de venda",
                    created_by=request.user,
                )
            sale.status = Sale.Status.CANCELLED
            sale.notes = "\n".join(filter(None, [sale.notes, (request.data or {}).get("reason", "Venda cancelada")]))
            sale.save(update_fields=["status", "notes", "updated_at"])
            sale.commissions.filter(status=Commission.Status.ACCRUED).update(
                status=Commission.Status.REVERSED, notes="Estornada por cancelamento da venda", updated_at=timezone.now()
            )
            from customers.loyalty import reverse_loyalty_and_promotions
            reverse_loyalty_and_promotions(sale)
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=["get"])
    def receipt(self, request, pk=None):
        sale = self.get_queryset().get(pk=pk)
        if request.query_params.get("reprint") == "true":
            Sale.objects.filter(pk=sale.pk).update(
                receipt_reprint_count=models.F("receipt_reprint_count") + 1,
                updated_at=timezone.now(),
            )
            sale.refresh_from_db()
        from settings_app.models import Settings
        config = Settings.objects.first()
        tax_rate = config.tax_rate if config else Decimal("0")
        tax_amount = (sale.total_amount * tax_rate / (Decimal("100") + tax_rate)).quantize(Decimal("0.01")) if tax_rate else Decimal("0")
        return Response({
            "number": sale.receipt_number,
            "issued_at": sale.receipt_issued_at,
            "copy": sale.receipt_reprint_count,
            "business": {
                "name": config.business_name if config else "O Capitão", "legal_name": config.legal_name if config else "",
                "nuit": config.nuit if config else "", "address": config.address if config else "",
                "phone": config.phone if config else "", "header": config.receipt_header if config else "", "footer": config.receipt_footer if config else "",
            },
            "customer": sale.customer_name or sale.label,
            "operator": sale.seller.user.get_full_name() if sale.seller_id else "",
            "items": self.get_serializer(sale).data["items"],
            "payments": self.get_serializer(sale).data["payments"],
            "subtotal": sale.subtotal, "discount": sale.discount_amount, "total": sale.total_amount,
            "tax_rate": tax_rate, "tax_included": tax_amount, "status": sale.status,
        })


class SaleItemViewSet(SoftDeleteModelViewSet):
    queryset = SaleItem.objects.select_related("sale", "product", "service").all()
    serializer_class = SaleItemSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
    }

    def perform_destroy(self, instance):
        sale = instance.sale
        super().perform_destroy(instance)
        sale.recalculate_totals()
        sale.save(update_fields=["subtotal", "total_amount", "updated_at"])


class PaymentViewSet(SoftDeleteModelViewSet):
    queryset = Payment.objects.select_related("sale").all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["pos.view", "pos.manage"],
        "retrieve": ["pos.view", "pos.manage"],
        "create": ["pos.manage"],
        "update": ["pos.manage"],
        "partial_update": ["pos.manage"],
        "destroy": ["pos.manage"],
    }


class CommissionViewSet(SoftDeleteModelViewSet):
    queryset = Commission.objects.select_related("sale", "employee__user").all()
    serializer_class = CommissionSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["reports.view", "settings.manage"],
        "retrieve": ["reports.view", "settings.manage"],
        "create": ["settings.manage"],
        "update": ["settings.manage"],
        "partial_update": ["settings.manage"],
        "destroy": ["settings.manage"],
    }

# Create your views here.
