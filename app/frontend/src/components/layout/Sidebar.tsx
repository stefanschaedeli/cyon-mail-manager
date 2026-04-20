import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Globe,
  Users,
  LogOut,
  ShieldCheck,
  ScrollText,
  Mail,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-zinc-800 text-white"
            : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
        )
      }
    >
      <span className="shrink-0 w-4 h-4">{icon}</span>
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4">
        <Mail className="h-5 w-5 text-zinc-300" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white tracking-tight leading-tight">
            Mail Manager
          </span>
          <span className="text-[10px] text-zinc-600 leading-tight">
            v{__APP_VERSION__}
          </span>
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavItem
          to="/"
          icon={<LayoutDashboard className="h-4 w-4" />}
          label="Domains"
        />

        {user?.role === "admin" && (
          <>
            <div className="px-3 pt-4 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Admin
              </p>
            </div>
            <NavItem
              to="/admin"
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Dashboard"
            />
            <NavItem
              to="/admin/users"
              icon={<Users className="h-4 w-4" />}
              label="Users"
            />
            <NavItem
              to="/admin/domains"
              icon={<Globe className="h-4 w-4" />}
              label="Domains"
            />
            <NavItem
              to="/admin/audit"
              icon={<ScrollText className="h-4 w-4" />}
              label="Audit Log"
            />
          </>
        )}
      </nav>

      <Separator className="bg-zinc-800" />

      {/* User + logout */}
      <div className="px-3 py-4 space-y-2">
        <div className="px-3">
          <p className="text-xs font-medium text-white truncate">{user?.username}</p>
          <p className="text-xs text-zinc-500 capitalize">{user?.role}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-zinc-400 hover:text-white hover:bg-zinc-800/60"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
