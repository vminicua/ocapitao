from config.common.serializers import SyncableModelSerializer

from .models import Settings


class SettingsSerializer(SyncableModelSerializer):
    class Meta:
        model = Settings
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "business_name",
            "legal_name",
            "nuit",
            "address",
            "city",
            "country",
            "phone",
            "email",
            "currency_code",
            "currency_symbol",
            "timezone",
            "tax_rate",
            "appointment_slot_minutes",
            "receipt_header",
            "receipt_footer",
            "printer_name",
            "business_hours",
            "backup_folder",
            "ssh_tunnel_command",
            "sync_interval_seconds",
            "auto_sync_enabled",
            "enable_barbershop_module",
            "enable_bar_module",
            "enable_carwash_module",
            "enable_pos_module",
            "enable_reports_module",
            "allow_walk_in",
            "enable_low_stock_alerts",
            "allow_negative_stock",
            "require_pin_on_sale",
            "default_markup_percent",
            "default_commission_percent",
            "dark_mode",
        ]
