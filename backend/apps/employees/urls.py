from rest_framework.routers import SimpleRouter

from .views import DepartmentViewSet, EmployeeViewSet

router = SimpleRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("employees", EmployeeViewSet, basename="employee")

urlpatterns = router.urls