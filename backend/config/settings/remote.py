from .base import *  # noqa: F401,F403


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": MYSQL_DB,
        "USER": MYSQL_USER,
        "PASSWORD": MYSQL_PASSWORD,
        "HOST": MYSQL_HOST,
        "PORT": MYSQL_PORT,
        "OPTIONS": {
            "charset": "utf8mb4",
        },
    }
}

SYNC_ENABLED = False
