from rest_framework.routers import SimpleRouter

from .views import LeaveBalanceViewSet, LeaveRequestViewSet, LeaveTypeViewSet

router = SimpleRouter()
router.register("leave-types", LeaveTypeViewSet, basename="leave-type")
router.register("leave-balances", LeaveBalanceViewSet, basename="leave-balance")
router.register("leave-requests", LeaveRequestViewSet, basename="leave-request")

urlpatterns = router.urls