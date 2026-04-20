import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, UserCheck, UserX, Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { fetchUsers, createUser, updateUser, deleteUser } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { User, UserCreate, UserUpdate } from "@/types";

// ── SortableHeader ────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc" | null;

function SortableHeader({
  col,
  label,
  sortCol,
  sortDir,
  onSort,
  className,
}: {
  col: string;
  label: string;
  sortCol: string | null;
  sortDir: SortDir;
  onSort: (col: string) => void;
  className?: string;
}) {
  const active = sortCol === col;
  return (
    <TableHead
      className={`text-zinc-400 cursor-pointer select-none hover:text-zinc-200 ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && sortDir === "asc" && <ChevronUp className="h-3.5 w-3.5" />}
        {active && sortDir === "desc" && <ChevronDown className="h-3.5 w-3.5" />}
        {!active && <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
      </span>
    </TableHead>
  );
}

// ── Create dialog ─────────────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "customer">("customer");

  const mutation = useMutation({
    mutationFn: (data: UserCreate) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User created");
      onOpenChange(false);
      setUsername("");
      setPassword("");
      setEmail("");
      setRole("customer");
    },
    onError: () => toast.error("Failed to create user"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !email.trim()) return;
    mutation.mutate({ username: username.trim(), password, email: email.trim(), role });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="cu-username">Username</Label>
            <Input
              id="cu-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Password</Label>
            <Input
              id="cu-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-email">Email</Label>
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "admin" | "customer")}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="customer" className="text-zinc-100 focus:bg-zinc-700">
                  Customer
                </SelectItem>
                <SelectItem value="admin" className="text-zinc-100 focus:bg-zinc-700">
                  Admin
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="text-zinc-400 hover:text-zinc-100"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !username.trim() || !password.trim() || !email.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditUserDialog({
  user,
  onOpenChange,
}: {
  user: User | null;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setIsActive(user.is_active);
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: (data: UserUpdate) => updateUser(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User updated");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update user"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    mutation.mutate({ email: email.trim(), is_active: isActive });
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User — {user?.username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="eu-email">Email</Label>
            <Input
              id="eu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="eu-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="eu-active" className="cursor-pointer">
              Active
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="text-zinc-400 hover:text-zinc-100"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !email.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteUserDialog({
  user,
  onOpenChange,
}: {
  user: User | null;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteUser(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User deleted");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to delete user"),
  });

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
        </DialogHeader>
        <p className="text-zinc-400 text-sm">
          Delete <span className="text-zinc-200 font-medium">{user?.username}</span>? This cannot be undone.
        </p>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-100"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: me } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchUsers,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);

  function handleSort(col: string) {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortCol(null);
      setSortDir(null);
    }
  }

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = searchQuery.trim().toLowerCase();
    let result = q
      ? users.filter(
          (u) =>
            u.username.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
        )
      : [...users];

    if (sortCol && sortDir) {
      result.sort((a, b) => {
        let av: string, bv: string;
        if (sortCol === "username") { av = a.username; bv = b.username; }
        else if (sortCol === "email") { av = a.email; bv = b.email; }
        else if (sortCol === "role") { av = a.role; bv = b.role; }
        else if (sortCol === "status") { av = a.is_active ? "active" : "inactive"; bv = b.is_active ? "active" : "inactive"; }
        else { av = a.created_at; bv = b.created_at; }
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [users, searchQuery, sortCol, sortDir]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">Users</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-7 h-8 w-48 bg-zinc-800 border-zinc-700 text-zinc-100 text-sm focus-visible:ring-zinc-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New User
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 bg-zinc-800 rounded" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-md border border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <SortableHeader col="username" label="Username" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader col="email" label="Email" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader col="role" label="Role" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-24" />
                <SortableHeader col="status" label="Status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-24" />
                <SortableHeader col="created" label="Created" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-36" />
                <TableHead className="text-zinc-400 w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} className="border-zinc-800 hover:bg-zinc-800/50">
                  <TableCell className="text-zinc-100 font-medium">
                    {u.username}
                    {u.id === me?.id && (
                      <span className="ml-2 text-xs text-zinc-500">(you)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        u.role === "admin"
                          ? "border-amber-600 text-amber-400"
                          : "border-zinc-600 text-zinc-400"
                      }
                    >
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.is_active ? (
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <UserCheck className="h-3.5 w-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-zinc-500 text-sm">
                        <UserX className="h-3.5 w-3.5" />
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-500 text-sm">
                    {new Date(u.created_at).toLocaleDateString("de-CH")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
                        onClick={() => setEditUser(u)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-zinc-400 hover:text-red-400 disabled:opacity-30"
                        disabled={u.id === me?.id}
                        onClick={() => setDeleteTarget(u)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : searchQuery ? (
        <p className="text-center text-zinc-500 py-8">
          No results for «{searchQuery}»
        </p>
      ) : (
        <p className="text-center text-zinc-500 py-8">No users yet.</p>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDialog
        user={editUser}
        onOpenChange={(v) => !v && setEditUser(null)}
      />
      <DeleteUserDialog
        user={deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      />
    </div>
  );
}
