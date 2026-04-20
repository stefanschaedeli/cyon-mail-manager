import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return <Outlet />;
}
