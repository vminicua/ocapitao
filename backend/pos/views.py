from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import CashMovement, CashSession, OperationalSession, Payment, Sale, SaleItem
from inventory.models import StockMovement
from .serializers import (
    CashMovementSerializer,
    CashSessionSerializer,
    CompleteSaleSerializer,
    OperationalSessionSerializer,
    PaymentSerializer,
    SaleItemSerializer,
    SaleSerializer,
)


class OperationalSessionViewSet(SoftDeleteModelViewSet):
    queryset = OperationalSession.objects.select_related("created_by").all()
    serializer_class = OperationalSessionSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"*": ["pos.view", "pos.manage"], "snapshot": ["pos.manage"]}

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
        "cancel": ["pos.manage"],
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
        return Response(self.get_serializer(sale).data)


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

# Create your views here.
