import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Mail, Forward, Globe, Search, X } from "lucide-react";
import { fetchDomains, fetchEmails, fetchForwards } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import type { Domain } from "@/types";

function DomainCard({ domain }: { domain: Domain }) {
  const navigate = useNavigate();

  const { data: emails } = useQuery({
    queryKey: ["domains", domain.name, "emails"],
    queryFn: () => fetchEmails(domain.name),
  });

  const { data: forwards } = useQuery({
    queryKey: ["domains", domain.name, "forwards"],
    queryFn: () => fetchForwards(domain.name),
  });

  return (
    <Card
      className="bg-zinc-900 border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors"
      onClick={() => navigate(`/domains/${domain.name}`)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Globe className="h-4 w-4 text-zinc-400" />
          {domain.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4 text-sm text-zinc-400">
        <span className="flex items-center gap-1">
          <Mail className="h-3.5 w-3.5" />
          {emails === undefined ? (
            <Skeleton className="h-4 w-4 bg-zinc-700" />
          ) : (
            <span>
              {emails.length}
              {domain.max_emails > 0 ? ` / ${domain.max_emails}` : ""} email
              {emails.length !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <Forward className="h-3.5 w-3.5" />
          {forwards === undefined ? (
            <Skeleton className="h-4 w-4 bg-zinc-700" />
          ) : (
            <span>
              {forwards.length}
              {domain.max_forwards > 0 ? ` / ${domain.max_forwards}` : ""}{" "}
              forward{forwards.length !== 1 ? "s" : ""}
            </span>
          )}
        </span>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: domains, isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: fetchDomains,
  });

  const filtered = useMemo(() => {
    if (!domains) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter((d) => d.name.toLowerCase().includes(q));
  }, [domains, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Domains</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 bg-zinc-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!domains || domains.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Domains</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Globe className="h-12 w-12 text-zinc-600 mb-4" />
          <p className="text-zinc-400 text-lg">No domains assigned yet.</p>
          <p className="text-zinc-500 text-sm mt-1">
            Contact your administrator to get domains assigned.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">Domains</h1>
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
      </div>
      {filtered.length === 0 && searchQuery ? (
        <p className="text-center text-zinc-500 py-8">
          No results for «{searchQuery}»
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>
      )}
    </div>
  );
}
