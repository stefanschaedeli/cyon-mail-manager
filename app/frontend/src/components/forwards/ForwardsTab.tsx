import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RefreshCw, Download, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { fetchForwards, importForwards } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ForwardGroup } from "./ForwardGroup";
import { NewGroupDialog } from "./NewGroupDialog";
import type { Domain, ForwardGroup as ForwardGroupType } from "@/types";

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

interface ForwardsTabProps {
  domain: Domain;
}

export function ForwardsTab({ domain }: ForwardsTabProps) {
  const [newOpen, setNewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  const { data: forwards, isLoading } = useQuery({
    queryKey: ["domains", domain.name, "forwards"],
    queryFn: () => fetchForwards(domain.name),
  });

  const groups = useMemo<ForwardGroupType[]>(() => {
    if (!forwards) return [];

    // Build groups map
    const map = new Map<string, typeof forwards>();
    for (const fwd of forwards) {
      const existing = map.get(fwd.source) ?? [];
      existing.push(fwd);
      map.set(fwd.source, existing);
    }

    let result = Array.from(map.entries()).map(([source, destinations]) => ({
      source,
      sourceLocal: source.split("@")[0],
      destinations: [...destinations].sort((a, b) =>
        a.destination.localeCompare(b.destination)
      ),
    }));

    // Filter by search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (g) =>
          g.source.toLowerCase().includes(q) ||
          g.destinations.some((d) => d.destination.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortAsc !== null) {
      result.sort((a, b) => {
        const cmp = a.source.localeCompare(b.source);
        return sortAsc ? cmp : -cmp;
      });
    } else {
      result.sort((a, b) => a.source.localeCompare(b.source));
    }

    return result;
  }, [forwards, searchQuery, sortAsc]);

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
          <button
            onClick={() => setSortAsc((prev) => prev === null ? true : prev === true ? false : null)}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded px-2 py-1 h-8"
            title="Toggle sort order"
          >
            {sortAsc === true
              ? <><ChevronUp className="h-3 w-3" /><span>A→Z</span></>
              : sortAsc === false
              ? <><ChevronDown className="h-3 w-3" /><span>Z→A</span></>
              : <span>Sort</span>
            }
          </button>
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
      ) : groups.length > 0 ? (
        <div className="space-y-2">
          {groups.map((group) => (
            <ForwardGroup
              key={group.source}
              group={group}
              domainName={domain.name}
            />
          ))}
        </div>
      ) : searchQuery ? (
        <p className="text-center text-zinc-500 py-8">
          No results for «{searchQuery}»
        </p>
      ) : (
        <p className="text-center text-zinc-500 py-8">No forwards yet.</p>
      )}

      <NewGroupDialog
        domain={domain}
        open={newOpen}
        onOpenChange={setNewOpen}
      />
    </div>
  );
}
