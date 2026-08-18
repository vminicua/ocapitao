import hashlib
import json
import shutil
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.db import connections


class BackupService:
    def backup_directory(self) -> Path:
        from settings_app.models import Settings
        configured = (Settings.objects.first().backup_folder or "").strip() if Settings.objects.exists() else ""
        path = Path(configured) if configured else settings.ROOT_DIR / "data" / "backups"
        if not path.is_absolute():
            path = (settings.ROOT_DIR / path).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    def create(self, reason="manual", prune=True) -> dict:
        source = Path(settings.DATABASES["default"]["NAME"]).resolve()
        if settings.DATABASES["default"]["ENGINE"] != "django.db.backends.sqlite3":
            raise RuntimeError("O backup local só pode ser criado no modo SQLite.")
        target = self.backup_directory() / f"ocapitao-{datetime.now():%Y%m%d-%H%M%S-%f}.sqlite3"
        with closing(sqlite3.connect(source)) as source_db, closing(sqlite3.connect(target)) as target_db:
            source_db.backup(target_db)
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        manifest = {"file": target.name, "sha256": digest, "created_at": datetime.now().isoformat(), "reason": reason}
        target.with_suffix(".json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        if prune:
            self._prune()
        return manifest

    def list(self) -> list[dict]:
        manifests = []
        for path in sorted(self.backup_directory().glob("ocapitao-*.json"), reverse=True):
            try:
                manifests.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                continue
        return manifests

    def restore(self, filename: str) -> dict:
        if Path(filename).name != filename:
            raise ValueError("Nome de backup inválido.")
        source = (self.backup_directory() / filename).resolve()
        if source.parent != self.backup_directory().resolve() or not source.exists():
            raise FileNotFoundError("Backup não encontrado.")
        manifest_path = source.with_suffix(".json")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if hashlib.sha256(source.read_bytes()).hexdigest() != manifest.get("sha256"):
            raise ValueError("O backup está corrompido ou foi alterado.")
        safety = self.create(reason="pre_restore", prune=False)
        destination = Path(settings.DATABASES["default"]["NAME"]).resolve()
        connections.close_all()
        shutil.copy2(source, destination)
        self._prune()
        return {"restored": filename, "safety_backup": safety["file"]}

    def _prune(self, keep=14):
        files = sorted(self.backup_directory().glob("ocapitao-*.sqlite3"), reverse=True)
        for path in files[keep:]:
            path.unlink(missing_ok=True)
            path.with_suffix(".json").unlink(missing_ok=True)
