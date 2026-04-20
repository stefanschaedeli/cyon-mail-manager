import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
