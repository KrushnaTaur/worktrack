from django.contrib import admin

from .models import Department, EmployeeProfile


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ("employee_code", "user", "department", "job_title", "joined_on")
    list_filter = ("department",)
    search_fields = ("employee_code", "user__username", "user__email")