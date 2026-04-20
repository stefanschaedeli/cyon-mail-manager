import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Copy, Check, RefreshCw, Download } from "lucide-react";
import {
  fetchEmails,
  createEmail,
  deleteEmail,
  fetchForwards,
  createForward,
  deleteForward,
  importEmails,
  importForwards,
} from "@/lib/api";
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
import type { Domain, EmailAccount, EmailForward } from "@/types";
import { fetchDomains } from "@/lib/api";

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

// ── New Forward dialog ────────────────────────────────────────────────────────

function NewForwardDialog({
  domain,
  open,
  onOpenChange,
}: {
  domain: Domain;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [sourceLocal, setSourceLocal] = useState("");
  const [destination, setDestination] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [destError, setDestError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createForward(domain.name, {
        source_local: sourceLocal,
        destination,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["domains", domain.name, "forwards"],
      });
      toast.success(`Forward from ${sourceLocal}@${domain.name} created`);
      onOpenChange(false);
      resetForm();
    },
    onError: (err: { response?: { status: number; data?: { detail?: string } } }) => {
      const status = err.response?.status;
      if (status === 409) {
        toast.error("Forward already exists");
      } else {
        toast.error("Failed to create forward. Please try again.");
      }
    },
  });

  function resetForm() {
    setSourceLocal("");
    setDestination("");
    setSourceError("");
    setDestError("");
  }

  function handleClose() {
    onOpenChange(false);
    resetForm();
  }

  function validateSource(value: string) {
    if (!/^[a-zA-Z0-9._%+-]+$/.test(value)) {
      setSourceError("Only letters, numbers, and . _ % + - are allowed");
    } else {
      setSourceError("");
    }
  }

  function validateDest(value: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setDestError("Please enter a valid email address");
    } else {
      setDestError("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sourceError || destError || !sourceLocal || !destination) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>New Forward</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Source address</Label>
            <div className="flex items-center">
              <Input
                value={sourceLocal}
                onChange={(e) => {
                  setSourceLocal(e.target.value);
                  if (e.target.value) validateSource(e.target.value);
                  else setSourceError("");
                }}
                placeholder="username"
                required
                className="rounded-r-none bg-zinc-800 border-zinc-700 text-zinc-100 focus-visible:ring-zinc-500"
              />
              <span className="inline-flex items-center px-3 h-9 rounded-r-md border border-l-0 border-zinc-700 bg-zinc-700/50 text-zinc-400 text-sm whitespace-nowrap">
                @{domain.name}
              </span>
            </div>
            {sourceError && (
              <p className="text-xs text-red-400">{sourceError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Destination email</Label>
            <Input
              type="email"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                if (e.target.value) validateDest(e.target.value);
                else setDestError("");
              }}
              placeholder="user@example.com"
              required
              className="bg-zinc-800 border-zinc-700 text-zinc-100 focus-visible:ring-zinc-500"
            />
            {destError && (
              <p className="text-xs text-red-400">{destError}</p>
            )}
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
              disabled={
                mutation.isPending ||
                !sourceLocal ||
                !destination ||
                !!sourceError ||
                !!destError
              }
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

// ── Delete Forward dialog ─────────────────────────────────────────────────────

function DeleteForwardDialog({
  domainName,
  forward,
  open,
  onOpenChange,
}: {
  domainName: string;
  forward: EmailForward | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteForward(domainName, forward!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["domains", domainName, "forwards"],
      });
      toast.success(`Forward deleted`);
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to delete forward. Please try again.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Delete forward?</DialogTitle>
        </DialogHeader>
        <p className="text-zinc-400 text-sm">
          This will permanently delete the forward from{" "}
          <span className="text-zinc-200 font-medium">{forward?.source}</span>{" "}
          to{" "}
          <span className="text-zinc-200 font-medium">
            {forward?.destination}
          </span>
          . This action cannot be undone.
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

  const { data: emails, isLoading } = useQuery({
    queryKey: ["domains", domain.name, "emails"],
    queryFn: () => fetchEmails(domain.name),
  });

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
      ) : emails && emails.length > 0 ? (
        <div className="rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Address</TableHead>
                <TableHead className="text-zinc-400">Quota (MB)</TableHead>
                <TableHead className="text-zinc-400">Synced</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow
                  key={email.id}
                  className="border-zinc-800 hover:bg-zinc-800/50"
                >
                  <TableCell className="text-zinc-200 font-mono text-sm">
                    {email.address}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {email.quota_mb}
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

// ── Forwards tab ──────────────────────────────────────────────────────────────

function ForwardsTab({ domain }: { domain: Domain }) {
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailForward | null>(null);
  const queryClient = useQueryClient();

  const { data: forwards, isLoading } = useQuery({
    queryKey: ["domains", domain.name, "forwards"],
    queryFn: () => fetchForwards(domain.name),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {isLoading ? (
          <Skeleton className="h-5 w-40 bg-zinc-800" />
        ) : (
          <QuotaCounter
            used={forwards?.length ?? 0}
            max={domain.max_forwards}
            label="forward"
          />
        )}
        <div className="flex items-center gap-2">
          <ImportButton
            label="forwards"
            onImport={() => importForwards(domain.name)}
            onSuccess={(n) => {
              queryClient.invalidateQueries({
                queryKey: ["domains", domain.name, "forwards"],
              });
              toast.success(
                n > 0
                  ? `${n} forward${n !== 1 ? "s" : ""} imported`
                  : "No new forwards to import"
              );
            }}
          />
          <Button
            size="sm"
            onClick={() => setNewOpen(true)}
            className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Forward
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-12 bg-zinc-800 rounded" />
          ))}
        </div>
      ) : forwards && forwards.length > 0 ? (
        <div className="rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Source</TableHead>
                <TableHead className="text-zinc-400">Destination</TableHead>
                <TableHead className="text-zinc-400">Synced</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {forwards.map((fwd) => (
                <TableRow
                  key={fwd.id}
                  className="border-zinc-800 hover:bg-zinc-800/50"
                >
                  <TableCell className="text-zinc-200 font-mono text-sm">
                    {fwd.source}
                  </TableCell>
                  <TableCell className="text-zinc-400 font-mono text-sm">
                    {fwd.destination}
                  </TableCell>
                  <TableCell>
                    <SyncedDot synced={fwd.synced} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(fwd)}
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
      ) : (
        <p className="text-center text-zinc-500 py-8">No forwards yet.</p>
      )}

      <NewForwardDialog
        domain={domain}
        open={newOpen}
        onOpenChange={setNewOpen}
      />
      <DeleteForwardDialog
        domainName={domain.name}
        forward={deleteTarget}
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
