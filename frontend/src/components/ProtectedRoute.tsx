import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./ui";

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
