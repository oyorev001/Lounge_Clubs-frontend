import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ChevronRight, MapPin, Search, Tag } from "lucide-react";
import { useEffect, useState } from "react";

import { PaginationControls } from "@/components/common/pagination";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { EstablishmentStatusBadge } from "@/components/common/status-badges";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { OYO_LGAS } from "@/lib/oyo";
import { useDebounced } from "@/hooks/use-debounced";
import { cn } from "@/lib/utils";
import { establishmentsApi, queryKeys } from "@/services";
import type { EstablishmentStatus, EstablishmentType } from "@/services";

export const Route = createFileRoute("/admin/establishments/")({
  component: EstablishmentsPage,
});

const ALL = "all";
const PAGE_SIZE = 15;

const STATUSES: { value: EstablishmentStatus; label: string }[] = [
  { value: "PendingReview", label: "Pending review" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Suspended", label: "Suspended" },
  { value: "NonCompliant", label: "Non-compliant" },
  { value: "Closed", label: "Deregistered" },
];

const TYPES: EstablishmentType[] = ["Lounge", "Bar", "Club", "Nightclub"];

function EstablishmentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EstablishmentStatus | typeof ALL>(ALL);
  const [type, setType] = useState<EstablishmentType | typeof ALL>(ALL);
  const [lga, setLga] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search.trim());

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, lga, status, type]);

  const params = {
    page,
    per_page: PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status !== ALL ? { status } : {}),
    ...(type !== ALL ? { type } : {}),
    ...(lga !== ALL ? { lga } : {}),
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.establishments.all(params),
    queryFn: () => establishmentsApi.all(params),
  });

  const meta = data?.meta;

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Establishments"
        description="All registered lounges, bars and clubs — open a card for the full venue file."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or reg no."
                className="pl-8 sm:w-56"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as EstablishmentStatus | typeof ALL)}
            >
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={type}
              onValueChange={(v) => setType(v as EstablishmentType | typeof ALL)}
            >
              <SelectTrigger className="sm:w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={lga} onValueChange={setLga}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="LGA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All LGAs</SelectItem>
                {OYO_LGAS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : isError ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data && data.data.length > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.data.map((e) => (
                <Link
                  key={e.id}
                  to="/admin/establishments/$id"
                  params={{ id: e.id }}
                  className={cn(
                    "group relative rounded-xl border border-border bg-card p-4 transition",
                    "hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md",
                    e.status === "PendingReview" && "border-l-4 border-l-amber-400",
                    e.status === "Approved" && "border-l-4 border-l-emerald-500",
                    (e.status === "Suspended" || e.status === "NonCompliant") &&
                      "border-l-4 border-l-rose-400",
                    e.status === "Rejected" && "border-l-4 border-l-muted-foreground/40",
                    e.status === "Closed" && "border-l-4 border-l-border opacity-75",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="size-4.5 text-primary" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold group-hover:text-primary">
                          {e.name}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {e.registrationNumber}
                        </p>
                      </div>
                    </div>
                    <EstablishmentStatusBadge status={e.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <Tag className="size-3" />
                      {[e.type, ...e.additionalTypes].join(" + ")}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <MapPin className="size-3" /> {e.lga}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                    <span>
                      {e.tierName ?? e.tierCode ?? "No tier"} · registered{" "}
                      {new Date(e.createdAt).toLocaleDateString("en-NG")}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-medium text-brand opacity-0 transition group-hover:opacity-100">
                      Open <ChevronRight className="size-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            {meta ? (
              <PaginationControls
                index={meta.current_page - 1}
                totalPages={meta.last_page}
                total={meta.total}
                pageSize={meta.per_page}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            ) : null}
          </>
        ) : (
          <RouteEmpty
            title="No establishments found"
            hint="Try widening the filters or clearing the search."
          />
        )}
      </SectionCard>
    </div>
  );
}
