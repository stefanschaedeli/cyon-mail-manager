import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Globe, RefreshCw, Clock, User } from "lucide-react";
import {
  fetchUsers,
  fetchAdminDomains,
  fetchAudit,
  triggerSync,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number | undefined;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-400">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16 bg-zinc-800" />
        ) : (
          <p className="text-3xl font-bold text-zinc-100">{value ?? 0}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [syncing, setSyncing] = useState(false);

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchUsers,
  });

  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ["admin", "domains"],
    queryFn: fetchAdminDomains,
  });

  const { data: auditEntries, isLoading: auditLoading } = useQuery({
    queryKey: ["admin", "audit", 1],
    queryFn: () => fetchAudit(1),
  });

  const syncMutation = useMutation({
    mutationFn: triggerSync,
    onMutate: () => setSyncing(true),
    onSuccess: () => {
      toast.success("Sync completed successfully");
      setSyncing(false);
    },
    onError: () => {
      toast.error("Sync failed");
      setSyncing(false);
    },
  });

  const recentAudit = auditEntries?.slice(0, 10) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">
          Admin Dashboard
        </h1>
        <Button
          variant="outline"
          className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={() => syncMutation.mutate()}
          disabled={syncing}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`}
          />
          Sync Now
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title="Users"
          value={users?.length}
          icon={Users}
          loading={usersLoading}
        />
        <StatCard
          title="Domains"
          value={domains?.length}
          icon={Globe}
          loading={domainsLoading}
        />
      </div>

      {/* Recent activity */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-200">Recent Activity</h2>
        {auditLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 bg-zinc-800 rounded" />
            ))}
          </div>
        ) : recentAudit.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center">
            No audit entries yet.
          </p>
        ) : (
          <div className="rounded-md border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-44">Time</TableHead>
                  <TableHead className="text-zinc-400 w-24">User</TableHead>
                  <TableHead className="text-zinc-400">Action</TableHead>
                  <TableHead className="text-zinc-400">Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAudit.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                  >
                    <TableCell className="text-zinc-400 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {new Date(entry.created_at).toLocaleString("de-CH", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-300 text-sm">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-zinc-500 shrink-0" />
                        {entry.user_id ?? "system"}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-300 text-sm font-mono">
                      {entry.action}
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {entry.target}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
