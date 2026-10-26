import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  MapPin,
  Search as SearchIcon,
  Store,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useDebounced } from "@/hooks/use-debounced";
import { PaginationControls } from "@/components/common/pagination";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { complaintsApi, usersApi } from "@/services";
import type { Complaint, ComplaintStatus } from "@/services";
import { cn } from "@/lib/utils";

/** datetime-local inputs speak LOCAL time — UTC would let past dates through. */
function localDatetimeMin() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const OFFICER_ROLES = new Set(["Officer", "Admin"]);

export const Route = createFileRoute("/admin/complaints")({ component: ComplaintsPage });

const CATEGORY_LABELS: Record<string, string> = {
  Noise: "Noise",
  UnderageEntry: "Underage",
  UnlicensedOperation: "Unlicensed",
  Safety: "Safety",
  Other: "Other",
};

const STATUS_TONES: Record<ComplaintStatus, string> = {
  New: "bg-amber-100 text-amber-800",
  UnderReview: "bg-blue-100 text-blue-800",
  InspectionScheduled: "bg-violet-100 text-violet-800",
  Resolved: "bg-emerald-100 text-emerald-800",
  Dismissed: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  New: "New",
  UnderReview: "Under review",
  InspectionScheduled: "Inspection scheduled",
  Resolved: "Resolved",
  Dismissed: "Dismissed",
};

function ageOf(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

const venueKey = (c: Complaint) =>
  c.establishmentId ?? `desc:${(c.venueDescription ?? "").trim().toLowerCase()}`;

type Cluster = {
  key: string;
  rep: Complaint; // most recent complaint in the cluster
  items: Complaint[];
  openCount: number;
  categories: Record<string, number>;
};

function ComplaintsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ComplaintStatus | "">("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [converting, setConverting] = useState<Complaint | null>(null);
  const [dismissingIds, setDismissingIds] = useState<string[] | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [resolvingIds, setResolvingIds] = useState<string[] | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [clearAll, setClearAll] = useState<"Resolved" | "Dismissed" | null>(null);
  const [clearNote, setClearNote] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  const complaints = useQuery({
    queryKey: ["admin-complaints", status, category, debouncedSearch, page],
    queryFn: () =>
      complaintsApi.list({
        status: status || undefined,
        category: category || undefined,
        q: debouncedSearch || undefined,
        page,
      }),
  });
  const counts = complaints.data?.meta.counts ?? {};

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-complaints"] });

  const resolve = useMutation({
    mutationFn: ({
      ids,
      s,
      note,
    }: {
      ids: string[];
      s: "Resolved" | "Dismissed" | "UnderReview";
      note?: string;
    }) => complaintsApi.bulkStatus({ ids }, s, note),
    onSuccess: (r) => {
      toast.success(r.updated > 1 ? `${r.updated} complaints updated` : "Complaint updated");
      void refresh();
    },
    onError: (err: Error) => toast.error(err.message || "Update failed"),
  });

  const clearAllMutation = useMutation({
    mutationFn: () =>
      complaintsApi.bulkStatus(
        {
          allMatching: true,
          ...(status ? { fromStatus: status } : {}),
          ...(category ? { category } : {}),
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
        },
        clearAll!,
        clearNote.trim(),
      ),
    onSuccess: (r) => {
      toast.success(
        `${r.updated} complaint${r.updated === 1 ? "" : "s"} ${clearAll === "Resolved" ? "resolved" : "dismissed"}`,
      );
      setClearAll(null);
      setClearNote("");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Bulk update failed"),
  });

  const staff = useQuery({
    queryKey: ["admin", "users", "officers"],
    queryFn: () => usersApi.list({ page: 1, per_page: 100 }),
    enabled: converting !== null,
  });
  const officers = (staff.data?.data ?? []).filter((u) =>
    u.roles.some((r) => OFFICER_ROLES.has(r)),
  );

  // The complaint isn't the unit of work — the VENUE is. Cluster every report
  // under its venue; officers open a dossier and act on the whole file.
  const clusters: Cluster[] = (() => {
    const map = new Map<string, Complaint[]>();
    for (const c of complaints.data?.data ?? []) {
      const key = venueKey(c);
      const g = map.get(key) ?? [];
      g.push(c);
      map.set(key, g);
    }
    return [...map.entries()].map(([key, items]) => {
      const categories: Record<string, number> = {};
      for (const c of items) categories[c.category] = (categories[c.category] ?? 0) + 1;
      return {
        key,
        rep: items[0]!,
        items,
        openCount: items.filter((c) => c.status === "New" || c.status === "UnderReview").length,
        categories,
      };
    });
  })();
  const selected = clusters.find((cl) => cl.key === selectedKey) ?? clusters[0] ?? null;

  const inspect = useMutation({
    mutationFn: () =>
      complaintsApi.inspect(converting!.id, {
        ...(officerId ? { officerId } : {}),
        ...(scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
      }),
    onSuccess: () => {
      toast.success("Inspection scheduled from complaint");
      setConverting(null);
      setOfficerId("");
      setScheduledFor("");
      void refresh();
      void qc.invalidateQueries({ queryKey: ["inspections"] });
      void qc.invalidateQueries({ queryKey: ["establishments"] });
      void qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      void qc.invalidateQueries({ queryKey: ["admin", "establishments"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not schedule inspection"),
  });

  const openIdsOf = (cl: Cluster) =>
    cl.items.filter((c) => c.status === "New" || c.status === "UnderReview").map((c) => c.id);

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Complaint clusters"
        description="Reports grouped by venue — open a venue's file, then review, resolve or escalate the whole cluster"
      >
        {/* Status chips */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
              status === ""
                ? "bg-foreground text-background ring-foreground"
                : "bg-muted/60 text-muted-foreground ring-border hover:bg-muted",
            )}
          >
            All ·{" "}
            {Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) ||
              complaints.data?.meta.total ||
              0}
          </button>
          {(Object.keys(STATUS_LABELS) as ComplaintStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(status === s ? "" : s);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
                status === s
                  ? "bg-foreground text-background ring-foreground"
                  : `${STATUS_TONES[s]} ring-transparent hover:opacity-80`,
              )}
            >
              {STATUS_LABELS[s]} · {counts[s] ?? 0}
            </button>
          ))}
        </div>

        {/* Search + category + clear-all */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search venue, description or details…"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                setSelectedKey(null);
              }}
            />
          </div>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={!complaints.data?.meta.total}
            onClick={() => {
              setClearNote("");
              setClearAll("Resolved");
            }}
          >
            <ClipboardCheck className="size-4" />
            Clear shown ({complaints.data?.meta.total ?? 0})
          </Button>
        </div>

        {complaints.isPending ? (
          <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-72" />
          </div>
        ) : complaints.isError ? (
          <QueryError error={complaints.error} onRetry={() => void complaints.refetch()} />
        ) : clusters.length ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
              {/* ── Left — venue cluster index ── */}
              <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
                {clusters.map((cl) => {
                  const c = cl.rep;
                  const active = selected?.key === cl.key;
                  return (
                    <button
                      key={cl.key}
                      type="button"
                      onClick={() => setSelectedKey(cl.key)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition",
                        active
                          ? "border-primary bg-primary/[0.04] ring-1 ring-primary/40"
                          : "border-border bg-card hover:border-primary/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {c.establishmentId ? (
                            <Building2 className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <Store className="size-4 shrink-0 text-amber-600" />
                          )}
                          <p className="truncate text-sm font-semibold">
                            {c.establishmentName ?? c.venueDescription ?? "—"}
                          </p>
                        </div>
                        {cl.openCount > 0 ? (
                          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            {cl.openCount} open
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-muted-foreground">closed</span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.entries(cl.categories).map(([cat, n]) => (
                          <span
                            key={cat}
                            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {CATEGORY_LABELS[cat] ?? cat} ×{n}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="size-3" />
                        {c.establishmentId ? (
                          (c.lga ?? "—")
                        ) : (
                          <span className="text-amber-600">Not in registry</span>
                        )}
                        <span className="ml-auto">
                          {cl.items.length} report{cl.items.length === 1 ? "" : "s"} · latest{" "}
                          {ageOf(c.createdAt)}
                        </span>
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* ── Right — venue dossier ── */}
              {selected ? (
                <div className="rounded-lg border border-border">
                  {/* dossier header */}
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {selected.rep.establishmentName ?? selected.rep.venueDescription ?? "—"}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />
                          {selected.rep.establishmentId ? (
                            <>
                              {selected.rep.lga ?? "—"} ·{" "}
                              <Link
                                to="/admin/establishments/$id"
                                params={{ id: selected.rep.establishmentId! }}
                                className="font-medium text-brand hover:underline"
                              >
                                view establishment
                              </Link>
                            </>
                          ) : (
                            <span className="text-amber-600">
                              Not in registry — unregistered venue
                            </span>
                          )}
                        </p>
                      </div>
                      {selected.openCount > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selected.rep.establishmentId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() =>
                                setConverting(
                                  selected.items.find((x) => x.establishmentId) ?? selected.rep,
                                )
                              }
                            >
                              Schedule inspection
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={resolve.isPending}
                            onClick={() => {
                              setResolveNote("");
                              setResolvingIds(openIdsOf(selected));
                            }}
                          >
                            Resolve open ({selected.openCount})
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-destructive hover:text-destructive"
                            disabled={resolve.isPending}
                            onClick={() => {
                              setDismissReason("");
                              setDismissingIds(openIdsOf(selected));
                            }}
                          >
                            Dismiss open ({selected.openCount})
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* dossier — every report in the cluster */}
                  <div className="max-h-[30rem] divide-y divide-border overflow-y-auto">
                    {selected.items.map((c) => (
                      <div key={c.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[11px]">
                                {CATEGORY_LABELS[c.category] ?? c.category}
                              </Badge>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                  STATUS_TONES[c.status],
                                )}
                              >
                                {STATUS_LABELS[c.status]}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(c.createdAt).toLocaleString("en-GB")} ·{" "}
                                {ageOf(c.createdAt)} old
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm">{c.details}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {c.complainantName ?? "Anonymous"}
                              {c.complainantPhone ? ` · ${c.complainantPhone}` : ""} · ref{" "}
                              {c.id.slice(0, 8)}
                            </p>
                            {c.resolutionNote ? (
                              <p className="mt-1 rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                                <b>Note:</b> {c.resolutionNote}
                              </p>
                            ) : null}
                            {c.inspectionId ? (
                              <p className="mt-1 text-xs text-violet-700">
                                <ClipboardCheck className="mr-1 inline size-3.5" />
                                Converted to inspection —{" "}
                                <Link
                                  to="/admin/inspections"
                                  className="font-medium hover:underline"
                                >
                                  view
                                </Link>
                              </p>
                            ) : null}
                          </div>
                          {c.status === "New" || c.status === "UnderReview" ? (
                            <div className="flex shrink-0 flex-col gap-1">
                              {c.status === "New" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  disabled={resolve.isPending}
                                  onClick={() => resolve.mutate({ ids: [c.id], s: "UnderReview" })}
                                >
                                  Review
                                </Button>
                              ) : null}
                              {c.establishmentId ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setConverting(c)}
                                >
                                  Inspect
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setResolveNote("");
                                  setResolvingIds([c.id]);
                                }}
                              >
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => {
                                  setDismissReason("");
                                  setDismissingIds([c.id]);
                                }}
                              >
                                Dismiss
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {complaints.data && complaints.data.meta.last_page > 1 ? (
              <PaginationControls
                index={complaints.data.meta.current_page}
                totalPages={complaints.data.meta.last_page}
                total={complaints.data.meta.total}
                pageSize={complaints.data.meta.per_page}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(complaints.data!.meta.last_page, p + 1))}
              />
            ) : null}
          </>
        ) : (
          <RouteEmpty
            title="No complaints"
            hint={
              search || category || status
                ? "Nothing matches the current filters."
                : "Reports filed through the public form appear here for triage."
            }
          />
        )}
      </SectionCard>

      {/* Schedule inspection */}
      <Dialog
        open={converting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setConverting(null);
            setOfficerId("");
            setScheduledFor("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert complaint to inspection</DialogTitle>
            <DialogDescription>
              Schedule an inspection for{" "}
              {converting?.establishmentName ?? converting?.venueDescription ?? "this venue"} and
              mark the complaint as inspection-scheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Assign officer (optional)</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-assign (you)" />
              </SelectTrigger>
              <SelectContent>
                {officers.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {[o.firstName, o.lastName].filter(Boolean).join(" ") || o.userName} —{" "}
                    {o.roles.join(", ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-for">Scheduled for (optional)</Label>
            <Input
              id="sched-for"
              type="datetime-local"
              min={localDatetimeMin()}
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConverting(null)}>
              Cancel
            </Button>
            <Button disabled={inspect.isPending} onClick={() => inspect.mutate()}>
              {inspect.isPending ? "Scheduling…" : "Schedule inspection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear all matching */}
      <Dialog open={clearAll !== null} onOpenChange={(o) => !o && setClearAll(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Clear all {complaints.data?.meta.total ?? 0} shown complaints?
            </DialogTitle>
            <DialogDescription>
              This applies to every complaint matching the current filters — including ones on other
              pages. Pick the outcome and record why.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant={clearAll === "Resolved" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setClearAll("Resolved")}
            >
              Resolve all
            </Button>
            <Button
              variant={clearAll === "Dismissed" ? "destructive" : "outline"}
              className="flex-1"
              onClick={() => setClearAll("Dismissed")}
            >
              Dismiss all
            </Button>
          </div>
          <Textarea
            placeholder={
              clearAll === "Resolved"
                ? "What was done — e.g. Venue inspected and issued a noise abatement notice on 10 Oct."
                : "Why these are dismissed — e.g. Duplicate spam reports, already actioned under inspection 44."
            }
            value={clearNote}
            onChange={(e) => setClearNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearAll(null)}>
              Back
            </Button>
            <Button
              variant={clearAll === "Dismissed" ? "destructive" : "default"}
              disabled={clearAllMutation.isPending || clearNote.trim().length < 10}
              onClick={() => clearAllMutation.mutate()}
            >
              {clearAllMutation.isPending ? "Updating…" : `${clearAll} all`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve — required note */}
      <Dialog open={!!resolvingIds} onOpenChange={(o) => !o && setResolvingIds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Resolve{" "}
              {resolvingIds && resolvingIds.length > 1
                ? `${resolvingIds.length} complaints`
                : "this complaint"}
              ?
            </DialogTitle>
            <DialogDescription>
              Record what was done — this note becomes part of the audit trail.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Officer inspected the venue on 12 Oct — noise curfew confirmed and owner formally warned."
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolvingIds(null)}>
              Back
            </Button>
            <Button
              disabled={resolve.isPending || resolveNote.trim().length < 10}
              onClick={() => {
                if (resolvingIds)
                  resolve.mutate({
                    ids: resolvingIds,
                    s: "Resolved",
                    note: resolveNote.trim(),
                  });
                setResolvingIds(null);
              }}
            >
              {resolve.isPending ? "Resolving…" : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss — required reason */}
      <AlertDialog open={!!dismissingIds} onOpenChange={(o) => !o && setDismissingIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Dismiss{" "}
              {dismissingIds && dismissingIds.length > 1
                ? `${dismissingIds.length} complaints`
                : "this complaint"}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The report{dismissingIds && dismissingIds.length > 1 ? "s" : ""} will be closed
              without scheduling an inspection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for dismissal — required (e.g. duplicate of resolved report, venue outside jurisdiction)"
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            rows={2}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={dismissReason.trim().length < 5}
              onClick={() => {
                if (dismissingIds)
                  resolve.mutate({
                    ids: dismissingIds,
                    s: "Dismissed",
                    note: dismissReason.trim(),
                  });
                setDismissingIds(null);
              }}
            >
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
