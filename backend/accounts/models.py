from uuid import uuid4

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

from config.common.models import SyncableModel


class Permission(SyncableModel):
    module = models.CharField(max_length=50)
    code = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["module", "name"]

    def __str__(self) -> str:
        return self.name


class Role(SyncableModel):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, blank=True, related_name="roles")

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _build_username(self, email: str) -> str:
        prefix = email.split("@", 1)[0].replace(" ", "").lower()
        return f"{prefix}-{uuid4().hex[:6]}"

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("O email é obrigatório.")
        email = self.normalize_email(email)
        username = extra_fields.get("username") or self._build_username(email)
        extra_fields["username"] = username
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        # Programmatic creation supplies the definitive password. Accounts created
        # through the POS API keep the model default and must change their PIN.
        extra_fields.setdefault("force_password_change", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("force_password_change", False)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=25, blank=True)
    role = models.ForeignKey(Role, null=True, blank=True, on_delete=models.SET_NULL)
    force_password_change = models.BooleanField(default=True)
    is_online = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.get_full_name() or self.email


class Employee(SyncableModel):
    class Department(models.TextChoices):
        MANAGEMENT = "management", "Gestão"
        BARBERSHOP = "barbershop", "Barbershop"
        BAR = "bar", "Bar"
        CARWASH = "carwash", "Carwash"
        CASHIER = "cashier", "Caixa"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="employee_profile")
    department = models.CharField(max_length=20, choices=Department.choices)
    title = models.CharField(max_length=100, blank=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active_employee = models.BooleanField(default=True)
    hire_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["user__first_name", "user__last_name", "user__email"]

    def __str__(self) -> str:
        return self.user.get_full_name() or self.user.email

# Create your models here.
