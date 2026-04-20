import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, UserCheck, UserX } from "lucide-react";
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
  const [email, setEmail] = useState(user?.email ?? "");
  const [isActive, setIsActive] = useState(user?.is_active ?? true);

  // sync state when user changes
  if (user && email === "" && user.email) {
    setEmail(user.email);
    setIsActive(user.is_active);
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">Users</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New User
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 bg-zinc-800 rounded" />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Username</TableHead>
                <TableHead className="text-zinc-400">Email</TableHead>
                <TableHead className="text-zinc-400 w-24">Role</TableHead>
                <TableHead className="text-zinc-400 w-24">Status</TableHead>
                <TableHead className="text-zinc-400 w-36">Created</TableHead>
                <TableHead className="text-zinc-400 w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
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
