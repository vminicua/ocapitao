from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from config.common.serializers import SyncableModelSerializer

from .models import Employee, Permission, Role, User


class PermissionSerializer(SyncableModelSerializer):
    class Meta:
        model = Permission
        fields = "__all__"


class RoleSerializer(SyncableModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        source="permissions",
        write_only=True,
        required=False,
    )

    class Meta:
        model = Role
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role",
        write_only=True,
        allow_null=True,
        required=False,
    )
    password = serializers.CharField(write_only=True, required=False)
    department = serializers.ChoiceField(
        source="employee_profile.department",
        choices=Employee.Department.choices,
        required=False,
        allow_null=True,
    )
    title = serializers.CharField(source="employee_profile.title", required=False, allow_blank=True)
    commission_rate = serializers.DecimalField(
        source="employee_profile.commission_rate",
        max_digits=5,
        decimal_places=2,
        required=False,
    )
    is_active_employee = serializers.BooleanField(source="employee_profile.is_active_employee", required=False)
    hire_date = serializers.DateField(source="employee_profile.hire_date", required=False, allow_null=True)
    employee_notes = serializers.CharField(source="employee_profile.notes", required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "display_name",
            "email",
            "password",
            "first_name",
            "last_name",
            "phone",
            "role",
            "role_id",
            "force_password_change",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_online",
            "department",
            "title",
            "commission_rate",
            "is_active_employee",
            "hire_date",
            "employee_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["display_name", "created_at", "updated_at"]

    def get_display_name(self, obj: User) -> str:
        return obj.get_full_name().strip() or obj.username or obj.email

    def _upsert_employee(self, user: User, employee_data: dict | None) -> None:
        if employee_data is None:
            return

        existing = getattr(user, "employee_profile", None)
        department = employee_data.get("department") or getattr(existing, "department", None)

        if not department:
            return

        defaults = {
            "department": department,
            "title": employee_data.get("title", getattr(existing, "title", "")),
            "commission_rate": employee_data.get("commission_rate", getattr(existing, "commission_rate", 0)),
            "is_active_employee": employee_data.get(
                "is_active_employee",
                getattr(existing, "is_active_employee", True),
            ),
            "hire_date": employee_data.get("hire_date", getattr(existing, "hire_date", None)),
            "notes": employee_data.get("notes", getattr(existing, "notes", "")),
        }
        Employee.objects.update_or_create(user=user, defaults=defaults)

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        employee_data = validated_data.pop("employee_profile", None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        self._upsert_employee(user, employee_data)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        employee_data = validated_data.pop("employee_profile", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        self._upsert_employee(user, employee_data)
        return user


class EmployeeSerializer(SyncableModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source="user", write_only=True)

    class Meta:
        model = Employee
        fields = "__all__"


class LoginUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "role_name"]

    def get_display_name(self, obj: User) -> str:
        return obj.get_full_name().strip() or obj.username or obj.email


class PinTokenObtainPairSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False)
    login = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    pin = serializers.CharField(required=False, write_only=True, trim_whitespace=False)
    password = serializers.CharField(required=False, write_only=True, trim_whitespace=False)

    @staticmethod
    def get_token(user: User) -> RefreshToken:
        token = RefreshToken.for_user(user)
        token["username"] = user.username
        token["role"] = getattr(user.role, "code", "")
        return token

    def _resolve_user(self, attrs) -> User | None:
        user_id = attrs.get("user_id")
        if user_id is not None:
            return User.objects.filter(id=user_id).first()

        login = (attrs.get("login") or attrs.get("username") or attrs.get("email") or "").strip()
        if not login:
            return None

        return (
            User.objects.filter(
                Q(username__iexact=login)
                | Q(email__iexact=login)
                | Q(first_name__iexact=login)
            )
            .select_related("role")
            .order_by("id")
            .first()
        )

    def validate(self, attrs):
        secret = (attrs.get("pin") or attrs.get("password") or "").strip()
        if not secret:
            raise AuthenticationFailed("Introduza o PIN.")

        user = self._resolve_user(attrs)
        if not user or not user.is_active or not user.check_password(secret):
            raise AuthenticationFailed("Utilizador ou PIN inválido.")

        refresh = self.get_token(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }
