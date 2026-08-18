import os
import sys
import threading

from django.apps import AppConfig

_auto_connect_started = False


class SyncConfig(AppConfig):
    name = "sync"

    def ready(self):
        from . import signals  # noqa: F401

        # Database/setup commands must never create network side effects.
        non_serving_commands = {"check", "makemigrations", "migrate", "seed_initial_data", "shell", "test"}
        if any(command in sys.argv for command in non_serving_commands):
            return

        # Django's development server imports applications once in the
        # autoreloader parent and again in the serving child. Only the child
        # should own the SSH tunnel, otherwise both processes race for port
        # 5523. Other serving processes retain the normal startup behaviour.
        if "runserver" in sys.argv and os.environ.get("RUN_MAIN") != "true":
            return

        global _auto_connect_started
        if _auto_connect_started:
            return
        _auto_connect_started = True

        def delayed_auto_connect():
            import time
            time.sleep(2)
            from config.cloud_manager import CloudManager
            CloudManager.get().try_auto_connect()

            from .backup import BackupService
            from .services import SyncService
            from settings_app.models import Settings
            existing_backups = BackupService().list()
            last_backup_date = existing_backups[0].get("created_at", "")[:10] if existing_backups else None
            while True:
                try:
                    config = Settings.objects.first()
                    interval = max(30, config.sync_interval_seconds if config else 300)
                    if config and config.auto_sync_enabled:
                        SyncService().sync_pending()
                    today = time.strftime("%Y-%m-%d")
                    if today != last_backup_date:
                        BackupService().create(reason="daily")
                        last_backup_date = today
                except Exception:
                    interval = 300
                time.sleep(interval)

        threading.Thread(target=delayed_auto_connect, daemon=True, name="cloud-auto-connect").start()
