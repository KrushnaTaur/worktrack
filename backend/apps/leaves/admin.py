from django.contrib import admin

from .models import LeaveBalance, LeaveRequest, LeaveType


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "default_days")


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ("user", "leave_type", "year", "total_days", "used_days")
    list_filter = ("year", "leave_type")


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "leave_type", "start_date", "end_date", "days", "status")
    list_filter = ("status", "leave_type")
    search_fields = ("employee__username", "reason")