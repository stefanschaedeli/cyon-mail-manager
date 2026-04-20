import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Download, Loader2, Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import {
  fetchAdminDomains,
  fetchUsers,
  createDomain,
  updateDomain,
  deleteDomain,
  fetchCyonDomains,
  importDomains,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { Domain, DomainCreate, DomainUpdate, User } from "@/types";

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

function CreateDomainDialog({
  open,
  onOpenChange,
  customers,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customers: User[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [userId, setUserId] = useState<string>("none");
  const [maxEmails, setMaxEmails] = useState("0");
  const [maxForwards, setMaxForwards] = useState("0");

  const mutation = useMutation({
    mutationFn: (data: DomainCreate) => createDomain(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success("Domain created");
      onOpenChange(false);
      setName("");
      setUserId("none");
      setMaxEmails("0");
      setMaxForwards("0");
    },
    onError: () => toast.error("Failed to create domain"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      user_id: userId === "none" ? null : parseInt(userId),
      max_emails: parseInt(maxEmails) || 0,
      max_forwards: parseInt(maxForwards) || 0,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Domain</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="cd-name">Domain name</Label>
            <Input
              id="cd-name"
              placeholder="example.com"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Assign to user</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="none" className="text-zinc-400 focus:bg-zinc-700">
                  Unassigned
                </SelectItem>
                {customers.map((u) => (
                  <SelectItem
                    key={u.id}
                    value={String(u.id)}
                    className="text-zinc-100 focus:bg-zinc-700"
                  >
                    {u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cd-emails">Max emails (0 = unlimited)</Label>
              <Input
                id="cd-emails"
                type="number"
                min="0"
                value={maxEmails}
                onChange={(e) => setMaxEmails(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-forwards">Max forwards (0 = unlimited)</Label>
              <Input
                id="cd-forwards"
                type="number"
                min="0"
                value={maxForwards}
                onChange={(e) => setMaxForwards(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
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
            <Button type="submit" disabled={mutation.isPending || !name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditDomainDialog({
  domain,
  onOpenChange,
  customers,
}: {
  domain: Domain | null;
  onOpenChange: (v: boolean) => void;
  customers: User[];
}) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string>("none");
  const [maxEmails, setMaxEmails] = useState("0");
  const [maxForwards, setMaxForwards] = useState("0");

  useEffect(() => {
    if (domain) {
      setUserId(domain.user_id != null ? String(domain.user_id) : "none");
      setMaxEmails(String(domain.max_emails));
      setMaxForwards(String(domain.max_forwards));
    }
  }, [domain]);

  const mutation = useMutation({
    mutationFn: (data: DomainUpdate) => updateDomain(domain!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success("Domain updated");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update domain"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain) return;
    mutation.mutate({
      user_id: userId === "none" ? null : parseInt(userId),
      max_emails: parseInt(maxEmails) || 0,
      max_forwards: parseInt(maxForwards) || 0,
    });
  }

  return (
    <Dialog open={!!domain} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Domain — {domain?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Assign to user</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="none" className="text-zinc-400 focus:bg-zinc-700">
                  Unassigned
                </SelectItem>
                {customers.map((u) => (
                  <SelectItem
                    key={u.id}
                    value={String(u.id)}
                    className="text-zinc-100 focus:bg-zinc-700"
                  >
                    {u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ed-emails">Max emails (0 = unlimited)</Label>
              <Input
                id="ed-emails"
                type="number"
                min="0"
                value={maxEmails}
                onChange={(e) => setMaxEmails(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-forwards">Max forwards (0 = unlimited)</Label>
              <Input
                id="ed-forwards"
                type="number"
                min="0"
                value={maxForwards}
                onChange={(e) => setMaxForwards(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            </div>
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
            <Button type="submit" disabled={mutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteDomainDialog({
  domain,
  onOpenChange,
}: {
  domain: Domain | null;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteDomain(domain!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success("Domain deleted");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to delete domain"),
  });

  return (
    <Dialog open={!!domain} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Domain</DialogTitle>
        </DialogHeader>
        <p className="text-zinc-400 text-sm">
          Delete{" "}
          <span className="text-zinc-200 font-medium">{domain?.name}</span>?
          This removes the domain from this app only — mailboxes and forwards
          on cyon are not affected. This cannot be undone.
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

// ── Import from cyon dialog ───────────────────────────────────────────────────

function ImportDomainsDialog({
  open,
  onOpenChange,
  available,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  available: string[];
}) {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Set<string>>(new Set(available));

  // Reset when dialog opens with new data
  if (open && checked.size === 0 && available.length > 0) {
    setChecked(new Set(available));
  }

  function toggle(domain: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: () => importDomains([...checked]),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "domains"] });
      toast.success(`${created.length} domain${created.length !== 1 ? "s" : ""} imported`);
      onOpenChange(false);
      setChecked(new Set());
    },
    onError: () => toast.error("Import failed"),
  });

  const selectedCount = checked.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import from cyon</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-400">
          {available.length} new domain{available.length !== 1 ? "s" : ""} found on cyon.
          Select which to import as unassigned.
        </p>
        <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border border-zinc-800 p-2">
          {available.map((domain) => (
            <label
              key={domain}
              className="flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={checked.has(domain)}
                onChange={() => toggle(domain)}
                className="accent-zinc-400 h-4 w-4"
              />
              <span className="text-sm font-mono text-zinc-200">{domain}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-100"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={selectedCount === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Importing…" : `Import ${selectedCount} domain${selectedCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DomainsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editDomain, setEditDomain] = useState<Domain | null>(null);
  const [deleteDomain, setDeleteDomain] = useState<Domain | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [cyonDomains, setCyonDomains] = useState<string[]>([]);
  const [fetchingCyon, setFetchingCyon] = useState(false);

  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ["admin", "domains"],
    queryFn: fetchAdminDomains,
  });

  const { data: users } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchUsers,
  });

  const customers = users?.filter((u) => u.role === "customer") ?? [];
  const userMap = useMemo(
    () => new Map(users?.map((u) => [u.id, u.username]) ?? []),
    [users]
  );

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

  function cmpNum(a: number, b: number, dir: "asc" | "desc"): number {
    return dir === "asc" ? a - b : b - a;
  }

  const filtered = useMemo(() => {
    if (!domains) return [];
    const q = searchQuery.trim().toLowerCase();
    let result = q
      ? domains.filter((d) => {
          const assignedName = d.user_id != null ? (userMap.get(d.user_id) ?? "").toLowerCase() : "";
          return d.name.toLowerCase().includes(q) || assignedName.includes(q);
        })
      : [...domains];

    if (sortCol && sortDir) {
      result.sort((a, b) => {
        if (sortCol === "name") {
          const cmp = a.name.localeCompare(b.name);
          return sortDir === "asc" ? cmp : -cmp;
        }
        if (sortCol === "assigned") {
          const aNull = a.user_id == null;
          const bNull = b.user_id == null;
          if (aNull && bNull) return 0;
          if (aNull) return 1;   // unassigned always goes to bottom
          if (bNull) return -1;
          const av = userMap.get(a.user_id!) ?? "";
          const bv = userMap.get(b.user_id!) ?? "";
          const cmp = av.localeCompare(bv);
          return sortDir === "asc" ? cmp : -cmp;
        }
        if (sortCol === "max_emails") return cmpNum(a.max_emails, b.max_emails, sortDir);
        if (sortCol === "max_forwards") return cmpNum(a.max_forwards, b.max_forwards, sortDir);
        // created
        const cmp = a.created_at.localeCompare(b.created_at);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [domains, searchQuery, sortCol, sortDir, userMap]);

  async function handleImportClick() {
    setFetchingCyon(true);
    try {
      const available = await fetchCyonDomains();
      if (available.length === 0) {
        toast.success("All cyon domains are already imported");
      } else {
        setCyonDomains(available);
        setImportOpen(true);
      }
    } catch {
      toast.error("Failed to fetch domains from cyon");
    } finally {
      setFetchingCyon(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">Domains</h1>
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
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={handleImportClick}
            disabled={fetchingCyon}
          >
            {fetchingCyon ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Import from cyon
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
        </div>
      </div>

      {domainsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 bg-zinc-800 rounded" />
          ))}
        </div>
      ) : (
        <>
        <div className="rounded-md border border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <SortableHeader col="name" label="Domain" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader col="assigned" label="Assigned to" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-36" />
                <SortableHeader col="max_emails" label="Max emails" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-28 text-center" />
                <SortableHeader col="max_forwards" label="Max forwards" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-28 text-center" />
                <SortableHeader col="created" label="Created" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-36" />
                <TableHead className="text-zinc-400 w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow
                  key={d.id}
                  className="border-zinc-800 hover:bg-zinc-800/50"
                >
                  <TableCell className="text-zinc-100 font-medium font-mono text-sm">
                    {d.name}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {d.user_id != null
                      ? userMap.get(d.user_id) ?? `#${d.user_id}`
                      : <span className="text-zinc-600 italic">unassigned</span>}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm text-center">
                    {d.max_emails === 0 ? "∞" : d.max_emails}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm text-center">
                    {d.max_forwards === 0 ? "∞" : d.max_forwards}
                  </TableCell>
                  <TableCell className="text-zinc-500 text-sm">
                    {new Date(d.created_at).toLocaleDateString("de-CH")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
                        onClick={() => setEditDomain(d)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-zinc-400 hover:text-red-400"
                        onClick={() => setDeleteDomain(d)}
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
        {filtered.length === 0 && searchQuery && (
          <p className="text-center text-zinc-500 py-8">
            No results for «{searchQuery}»
          </p>
        )}
        </>
      )}

      <CreateDomainDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        customers={customers}
      />
      <EditDomainDialog
        domain={editDomain}
        onOpenChange={(v) => !v && setEditDomain(null)}
        customers={customers}
      />
      <DeleteDomainDialog
        domain={deleteDomain}
        onOpenChange={(v) => !v && setDeleteDomain(null)}
      />
      <ImportDomainsDialog
        open={importOpen}
        onOpenChange={(v) => { setImportOpen(v); if (!v) setCyonDomains([]); }}
        available={cyonDomains}
      />
    </div>
  );
}
