import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, User, ChevronDown } from "lucide-react";
import { fetchAudit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditEntry } from "@/types";

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () => fetchAudit(page),
    placeholderData: (prev) => prev,
  });

  // Accumulate pages
  if (data && data.length > 0) {
    const existingIds = new Set(entries.map((e) => e.id));
    const newEntries = data.filter((e) => !existingIds.has(e.id));
    if (newEntries.length > 0) {
      setEntries((prev) => [...prev, ...newEntries]);
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }
    }
  } else if (data && data.length === 0 && page > 1) {
    setHasMore(false);
  }

  const allEntries = entries.length > 0 ? entries : data ?? [];
  const showLoadMore = hasMore && !isLoading && allEntries.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-100">Audit Log</h1>

      {isLoading && entries.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-10 bg-zinc-800 rounded" />
          ))}
        </div>
      ) : allEntries.length === 0 ? (
        <p className="text-zinc-500 text-sm py-16 text-center">
          No audit entries yet.
        </p>
      ) : (
        <>
          <div className="rounded-md border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-44">Time</TableHead>
                  <TableHead className="text-zinc-400 w-28">User</TableHead>
                  <TableHead className="text-zinc-400 w-40">Action</TableHead>
                  <TableHead className="text-zinc-400 w-48">Target</TableHead>
                  <TableHead className="text-zinc-400">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allEntries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                  >
                    <TableCell className="text-zinc-400 text-xs font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {new Date(entry.created_at).toLocaleString("de-CH", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-300 text-sm">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-zinc-500 shrink-0" />
                        {entry.user_id ?? (
                          <span className="text-zinc-500 italic">system</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-300 text-xs font-mono">
                      {entry.action}
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm font-mono">
                      {entry.target}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm">
                      {entry.detail ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {showLoadMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                disabled={isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronDown className="h-4 w-4 mr-2" />
                {isFetching ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}

          {!hasMore && allEntries.length > 0 && (
            <p className="text-center text-zinc-600 text-sm">
              All {allEntries.length} entries loaded.
            </p>
          )}
        </>
      )}
    </div>
  );
}
