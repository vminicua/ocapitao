from django.db.models import Avg, Count, DecimalField, F, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse
import csv
from datetime import timedelta

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet
from pos.models import CashSession, Commission, Payment, Sale, SaleItem
from bar.models import Product
from inventory.models import StockMovement
from sync.models import SyncLog
from sync.services import SyncService

from barbershop.models import Appointment

from .models import DailySnapshot
from .serializers import DailySnapshotSerializer


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"get": ["dashboard.view"]}

    def get(self, request):
        today = timezone.localdate()
        sales_today = Sale.objects.filter(created_at__date=today, status=Sale.Status.COMPLETED, deleted_at__isnull=True)
        money_field = DecimalField(max_digits=10, decimal_places=2)
        totals = sales_today.aggregate(total=Coalesce(Sum("total_amount"), Value(0), output_field=money_field))
        by_department = sales_today.values("department").annotate(
            total=Coalesce(Sum("total_amount"), Value(0), output_field=money_field)
        )
        pending_services = Appointment.objects.filter(
            scheduled_for__date=today,
            status__in=[Appointment.Status.SCHEDULED, Appointment.Status.IN_PROGRESS],
            deleted_at__isnull=True,
        ).count()
        cash_open = CashSession.objects.filter(status=CashSession.Status.OPEN, deleted_at__isnull=True).exists()
        sync_status = SyncService().status()
        last_sync = SyncLog.objects.first()

        return Response(
            {
                "data": today.isoformat(),
                "total_vendas": totals["total"],
                "totais_por_area": {item["department"]: item["total"] for item in by_department},
                "servicos_pendentes": pending_services,
                "caixa_aberto": cash_open,
                "estado_sincronizacao": sync_status,
                "ultima_sincronizacao": getattr(last_sync, "created_at", None),
            }
        )


class DailySnapshotViewSet(SoftDeleteModelViewSet):
    queryset = DailySnapshot.objects.all()
    serializer_class = DailySnapshotSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_roles = {"*": ["admin", "manager"]}


class AnalyticsView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"get": ["reports.view"]}

    def get(self, request):
        today = timezone.localdate()
        date_from = request.query_params.get("date_from") or (today - timedelta(days=30)).isoformat()
        date_to = request.query_params.get("date_to") or today.isoformat()
        sales = Sale.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to, deleted_at__isnull=True)
        completed = sales.filter(status=Sale.Status.COMPLETED)
        money = DecimalField(max_digits=14, decimal_places=2)
        totals = completed.aggregate(
            revenue=Coalesce(Sum("total_amount"), Value(0), output_field=money),
            discounts=Coalesce(Sum("discount_amount"), Value(0), output_field=money),
            average_ticket=Coalesce(Avg("total_amount"), Value(0), output_field=money),
            sales_count=Count("id"),
            debts=Coalesce(Sum("balance_due"), Value(0), output_field=money),
        )
        by_department = list(completed.values("department").annotate(total=Sum("total_amount"), count=Count("id")).order_by("department"))
        by_payment = list(Payment.objects.filter(sale__in=completed, deleted_at__isnull=True).values("method").annotate(total=Sum("amount"), count=Count("id")).order_by("method"))
        top_items = list(SaleItem.objects.filter(sale__in=completed, deleted_at__isnull=True).values("description", "item_type").annotate(quantity=Sum("quantity"), total=Sum("total_price")).order_by("-quantity")[:20])
        inventory = Product.objects.filter(active=True, deleted_at__isnull=True).aggregate(
            units=Coalesce(Sum("stock_quantity"), Value(0), output_field=money),
            value=Coalesce(Sum(F("stock_quantity") * F("cost_price")), Value(0), output_field=money),
        )
        commissions = Commission.objects.filter(sale__in=completed, status=Commission.Status.ACCRUED, deleted_at__isnull=True).aggregate(total=Coalesce(Sum("amount"), Value(0), output_field=money))["total"]
        payload = {
            "date_from": date_from, "date_to": date_to, **totals,
            "cancelled_count": sales.filter(status=Sale.Status.CANCELLED).count(),
            "by_department": by_department, "by_payment": by_payment, "top_items": top_items,
            "inventory_units": inventory["units"], "inventory_value": inventory["value"],
            "low_stock_count": Product.objects.filter(active=True, stock_quantity__lte=F("low_stock_threshold"), deleted_at__isnull=True).count(),
            "internal_consumption": StockMovement.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to, reference_type=StockMovement.ReferenceType.INTERNAL_USE, deleted_at__isnull=True).aggregate(total=Coalesce(Sum("quantity"), Value(0), output_field=money))["total"],
            "losses": StockMovement.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to, reference_type=StockMovement.ReferenceType.LOSS, deleted_at__isnull=True).aggregate(total=Coalesce(Sum("quantity"), Value(0), output_field=money))["total"],
            "commissions": commissions,
        }
        if request.query_params.get("export") == "csv":
            response = HttpResponse(content_type="text/csv; charset=utf-8")
            response["Content-Disposition"] = f'attachment; filename="relatorio-{date_from}-{date_to}.csv"'
            writer = csv.writer(response)
            writer.writerow(["Indicador", "Valor"])
            for key in ["revenue", "sales_count", "average_ticket", "discounts", "debts", "cancelled_count", "inventory_value", "commissions"]:
                writer.writerow([key, payload[key]])
            return response
        return Response(payload)

# Create your views here.
