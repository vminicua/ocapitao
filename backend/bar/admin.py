from django.contrib import admin

from .models import Product, ProductCategory


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "sync_status", "updated_at")
    search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "sale_price", "stock_quantity", "low_stock_threshold", "active")
    list_filter = ("category", "active")
    search_fields = ("name", "sku")

# Register your models here.
