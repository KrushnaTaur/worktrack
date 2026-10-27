import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import ApplyLeavePage from "./pages/ApplyLeavePage";
import BalancesPage from "./pages/BalancesPage";
import DashboardPage from "./pages/DashboardPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import EmployeesPage from "./pages/EmployeesPage";
import LeaveRequestsPage from "./pages/LeaveRequestsPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="leaves" element={<LeaveRequestsPage />} />
          <Route path="leaves/new" element={<ApplyLeavePage />} />
          <Route path="balances" element={<BalancesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}