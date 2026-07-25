import threading

from django.apps import AppConfig

_auto_connect_started = False


class SyncConfig(AppConfig):
    name = "sync"

    def ready(self):
        from . import signals  # noqa: F401

        global _auto_connect_started
        if _auto_connect_started:
            return
        _auto_connect_started = True

        def delayed_auto_connect():
            import time
            time.sleep(2)
            from config.cloud_manager import CloudManager
            CloudManager.get().try_auto_connect()

        threading.Thread(target=delayed_auto_connect, daemon=True, name="cloud-auto-connect").start()
