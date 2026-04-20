import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Copy, Check, RefreshCw, Download, Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import {
  fetchEmails,
  createEmail,
  deleteEmail,
  importEmails,
} from "@/lib/api";
import { ForwardsTab } from "@/components/forwards/ForwardsTab";
import { generatePassword } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Domain, EmailAccount } from "@/types";
import { fetchDomains } from "@/lib/api";

// ── Sort helpers ──────────────────────────────────────────────────────────────

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

function cmpNum(a: number | null, b: number | null, dir: "asc" | "desc"): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

// ── Synced dot ────────────────────────────────────────────────────────────────

function SyncedDot({ synced }: { synced: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${synced ? "bg-green-500" : "bg-zinc-500"}`}
      title={synced ? "Synced" : "Pending sync"}
    />
  );
}

// ── Quota counter ─────────────────────────────────────────────────────────────

function QuotaCounter({
  used,
  max,
  label,
}: {
  used: number;
  max: number;
  label: string;
}) {
  if (max === 0) {
    return (
      <p className="text-sm text-zinc-400">
        {used} {label}
        {used !== 1 ? "s" : ""} (unlimited)
      </p>
    );
  }
  return (
    <p className="text-sm text-zinc-400">
      {used} of {max} {label}
      {max !== 1 ? "s" : ""} used
    </p>
  );
}

// ── New Email dialog ──────────────────────────────────────────────────────────

function NewEmailDialog({
  domain,
  open,
  onOpenChange,
}: {
  domain: Domain;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [localPart, setLocalPart] = useState("");
  const [password, setPassword] = useState(() => generatePassword(16));
  const [customPassword, setCustomPassword] = useState(false);
  const [quotaMb, setQuotaMb] = useState("");
  const [copied, setCopied] = useState(false);
  const [localPartError, setLocalPartError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createEmail(domain.name, {
        local_part: localPart,
        password,
        quota_mb: quotaMb ? parseInt(quotaMb) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["domains", domain.name, "emails"],
      });
      toast.success(`${localPart}@${domain.name} created`);
      onOpenChange(false);
      resetForm();
    },
    onError: (err: { response?: { status: number; data?: { detail?: string } } }) => {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 409) {
        toast.error("Email address already exists");
      } else if (status === 400 && detail) {
        toast.error(detail);
      } else {
        toast.error("Failed to create email. Please try again.");
      }
    },
  });

  function resetForm() {
    setLocalPart("");
    setPassword(generatePassword(16));
    setCustomPassword(false);
    setQuotaMb("");
    setCopied(false);
    setLocalPartError("");
  }

  function handleClose() {
    onOpenChange(false);
    resetForm();
  }

  function handleCopy() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRegenerate() {
    setPassword(generatePassword(16));
    setCopied(false);
  }

  function validateLocalPart(value: string) {
    if (!/^[a-zA-Z0-9._%+-]+$/.test(value)) {
      setLocalPartError(
        "Only letters, numbers, and . _ % + - are allowed"
      );
    } else {
      setLocalPartError("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (localPartError || !localPart) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>New Email Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Email address</Label>
            <div className="flex items-center gap-0">
              <Input
                value={localPart}
                onChange={(e) => {
                  setLocalPart(e.target.value);
                  if (e.target.value) validateLocalPart(e.target.value);
                  else setLocalPartError("");
                }}
                placeholder="username"
                required
                className="rounded-r-none bg-zinc-800 border-zinc-700 text-zinc-100 focus-visible:ring-zinc-500"
              />
              <span className="inline-flex items-center px-3 h-9 rounded-r-md border border-l-0 border-zinc-700 bg-zinc-700/50 text-zinc-400 text-sm whitespace-nowrap">
                @{domain.name}
              </span>
            </div>
            {localPartError && (
              <p className="text-xs text-red-400">{localPartError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Password</Label>
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(e) => customPassword && setPassword(e.target.value)}
                readOnly={!customPassword}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono text-sm focus-visible:ring-zinc-500"
              />
              {!customPassword && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 shrink-0"
                    title="Copy password"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleRegenerate}
                    className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 shrink-0"
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-zinc-300 underline"
              onClick={() => {
                setCustomPassword(!customPassword);
                if (!customPassword) setPassword("");
                else setPassword(generatePassword(16));
              }}
            >
              {customPassword
                ? "Use auto-generated password"
                : "Set custom password"}
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">
              Quota (MB){" "}
              <span className="text-zinc-500 font-normal">— optional</span>
            </Label>
            <Input
              type="number"
              min="1"
              value={quotaMb}
              onChange={(e) => setQuotaMb(e.target.value)}
              placeholder="Leave blank for default"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 focus-visible:ring-zinc-500"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !localPart || !!localPartError || (!customPassword ? false : !password)}
              className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            >
              {mutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Email dialog ───────────────────────────────────────────────────────

function DeleteEmailDialog({
  domainName,
  email,
  open,
  onOpenChange,
}: {
  domainName: string;
  email: EmailAccount | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteEmail(domainName, email!.address),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["domains", domainName, "emails"],
      });
      toast.success(`${email!.address} deleted`);
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to delete email. Please try again.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Delete email account?</DialogTitle>
        </DialogHeader>
        <p className="text-zinc-400 text-sm">
          This will permanently delete{" "}
          <span className="text-zinc-200 font-medium">{email?.address}</span>.
          This action cannot be undone.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Import from cyon button ───────────────────────────────────────────────────

function ImportButton({
  label,
  onImport,
  onSuccess,
}: {
  label: string;
  onImport: () => Promise<{ imported: number }>;
  onSuccess: (n: number) => void;
}) {
  const mutation = useMutation({
    mutationFn: onImport,
    onSuccess: (data) => onSuccess(data.imported),
    onError: () => toast.error(`Failed to import ${label} from cyon`),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? (
        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-1" />
      )}
      Load from cyon
    </Button>
  );
}

// ── Emails tab ────────────────────────────────────────────────────────────────

function EmailsTab({ domain }: { domain: Domain }) {
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailAccount | null>(null);
  const queryClient = useQueryClient();

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

  const { data: emails, isLoading } = useQuery({
    queryKey: ["domains", domain.name, "emails"],
    queryFn: () => fetchEmails(domain.name),
  });

  const filtered = useMemo(() => {
    if (!emails) return [];
    const q = searchQuery.trim().toLowerCase();
    let result = q
      ? emails.filter((e) => e.address.toLowerCase().includes(q))
      : [...emails];

    if (sortCol && sortDir) {
      result.sort((a, b) => {
        if (sortCol === "address") {
          const cmp = a.address.localeCompare(b.address);
          return sortDir === "asc" ? cmp : -cmp;
        }
        if (sortCol === "quota") {
          const av = a.quota_mb === 0 ? null : a.quota_mb;
          const bv = b.quota_mb === 0 ? null : b.quota_mb;
          return cmpNum(av, bv, sortDir);
        }
        if (sortCol === "used") return cmpNum(a.disk_used_mb, b.disk_used_mb, sortDir);
        if (sortCol === "messages") return cmpNum(a.message_count, b.message_count, sortDir);
        // created
        const cmp = a.created_at.localeCompare(b.created_at);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [emails, searchQuery, sortCol, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {isLoading ? (
          <Skeleton className="h-5 w-40 bg-zinc-800" />
        ) : (
          <QuotaCounter
            used={emails?.length ?? 0}
            max={domain.max_emails}
            label="account"
          />
        )}
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
          <ImportButton
            label="emails"
            onImport={() => importEmails(domain.name)}
            onSuccess={(n) => {
              queryClient.invalidateQueries({
                queryKey: ["domains", domain.name, "emails"],
              });
              toast.success(
                n > 0
                  ? `${n} email${n !== 1 ? "s" : ""} imported`
                  : "No new emails to import"
              );
            }}
          />
          <Button
            size="sm"
            onClick={() => setNewOpen(true)}
            className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Email
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-12 bg-zinc-800 rounded" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <SortableHeader col="address" label="Address" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader col="quota" label="Quota (MB)" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader col="used" label="Used (MB)" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader col="messages" label="Messages" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader col="created" label="Created" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <TableHead className="text-zinc-400">Synced</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((email) => (
                <TableRow
                  key={email.id}
                  className="border-zinc-800 hover:bg-zinc-800/50"
                >
                  <TableCell className="text-zinc-200 font-mono text-sm">
                    {email.address}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {email.quota_mb > 0 ? email.quota_mb : "—"}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {email.disk_used_mb !== null ? email.disk_used_mb!.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {email.message_count !== null ? email.message_count : "—"}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {email.created_at.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <SyncedDot synced={email.synced} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(email)}
                      className="text-zinc-500 hover:text-red-400 hover:bg-red-950/30 h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
        <p className="text-center text-zinc-500 py-8">
          No email accounts yet.
        </p>
      )}

      <NewEmailDialog
        domain={domain}
        open={newOpen}
        onOpenChange={setNewOpen}
      />
      <DeleteEmailDialog
        domainName={domain.name}
        email={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DomainDetailPage() {
  const { name } = useParams<{ name: string }>();
  const { data: domains, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: fetchDomains,
  });

  const domain = domains?.find((d) => d.name === name);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32 bg-zinc-800" />
        <Skeleton className="h-8 w-56 bg-zinc-800" />
        <Skeleton className="h-64 bg-zinc-800 rounded-lg" />
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Domains
        </Link>
        <p className="text-zinc-400">Domain not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ChevronLeft className="h-4 w-4" />
        Domains
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-100">{domain.name}</h1>

      <Tabs defaultValue="emails">
        <TabsList className="bg-zinc-800 border-zinc-700">
          <TabsTrigger
            value="emails"
            className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-zinc-100"
          >
            Email Accounts
          </TabsTrigger>
          <TabsTrigger
            value="forwards"
            className="data-[state=active]:bg-zinc-700 text-zinc-400 data-[state=active]:text-zinc-100"
          >
            Forwards
          </TabsTrigger>
        </TabsList>
        <TabsContent value="emails" className="mt-4">
          <EmailsTab domain={domain} />
        </TabsContent>
        <TabsContent value="forwards" className="mt-4">
          <ForwardsTab domain={domain} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
