from django.contrib import admin

from .models import Employee, Permission, Role, User


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("name", "module", "code", "sync_status", "updated_at")
    search_fields = ("name", "code", "module")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "sync_status", "updated_at")
    search_fields = ("name", "code")
    filter_horizontal = ("permissions",)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "first_name", "last_name", "role", "is_staff", "force_password_change")
    search_fields = ("email", "first_name", "last_name")
    list_filter = ("role", "is_staff", "is_active")


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("user", "department", "title", "commission_rate", "is_active_employee")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    list_filter = ("department", "is_active_employee")

# Register your models here.
