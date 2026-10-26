import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CalendarPlus, ClipboardCheck, ChevronLeft, ChevronRight, MapPin, Search, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PaginationControls } from "@/components/common/pagination";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { InspectionOutcomeBadge } from "@/components/common/status-badges";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { establishmentsApi, inspectionsApi, queryKeys } from "@/services";
import { useDebounced } from "@/hooks/use-debounced";
import { cn } from "@/lib/utils";
import type {
  Inspection,
  InspectionOutcome,
  InspectionType,
  EstablishmentListItem,
} from "@/services";

export const Route = createFileRoute("/admin/inspections")({ component: InspectionsPage });

const ALL = "all";
const PAGE_SIZE = 15;
const OUTCOMES: InspectionOutcome[] = ["Compliant", "Issues", "Critical"];
const INSPECTION_TYPES: { value: InspectionType; hint: string }[] = [
  { value: "Routine", hint: "Scheduled compliance check" },
  { value: "Complaint", hint: "Following a resident's report" },
  { value: "Enforcement", hint: "Non-compliance or violation" },
  { value: "Registration", hint: "New-venue verification" },
];

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-NG");
}

function InspectionsPage() {
  return (
    <div className="px-4 py-6 sm:px-8">
      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log">Log inspection</TabsTrigger>
          <TabsTrigger value="mine">My inspections</TabsTrigger>
          <TabsTrigger value="all">All inspections</TabsTrigger>
        </TabsList>
        <TabsContent value="log" className="mt-4">
          <LogInspectionTab />
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          <MyInspectionsTab />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <AllInspectionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AllInspectionsTab() {
  const [establishmentId, setEstablishmentId] = useState<string>(ALL);
  const [outcome, setOutcome] = useState<InspectionOutcome | typeof ALL>(ALL);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [establishmentId, outcome]);

  const params = {
    page,
    per_page: PAGE_SIZE,
    ...(establishmentId && establishmentId !== ALL ? { establishmentId } : {}),
    ...(outcome !== ALL ? { outcome } : {}),
  };

  const venues = useQuery({
    queryKey: ["admin", "establishments", "filter-list"],
    queryFn: () => establishmentsApi.all({ page: 1, per_page: 100 }),
  });

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.inspections.list(params),
    queryFn: () => inspectionsApi.list(params),
  });

  const meta = data?.meta;

  return (
    <SectionCard
      title="Inspections"
      description="Every scheduled and completed inspection across the state."
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Select value={establishmentId} onValueChange={setEstablishmentId}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="All establishments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All establishments</SelectItem>
              {(venues.data?.data ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            {OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcome(outcome === o ? ALL : o)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
                  outcome === o
                    ? "bg-foreground text-background ring-foreground"
                    : "bg-muted/60 text-muted-foreground ring-border hover:bg-muted",
                )}
              >
                {o}
              </button>
            ))}
          </div>
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
          <div className="space-y-2">
            {data.data.map((i) => (
              <div
                key={i.id}
                className={cn(
                  "rounded-lg border border-border bg-card px-4 py-3 transition hover:border-primary/50",
                  i.outcome === "Critical" && "border-l-4 border-l-rose-500",
                  i.outcome === "Issues" && "border-l-4 border-l-amber-400",
                  i.outcome === "Compliant" && "border-l-4 border-l-emerald-500",
                  !i.outcome && "border-l-4 border-l-blue-400",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/admin/establishments/$id"
                        params={{ id: i.establishmentId }}
                        className="text-sm font-semibold text-brand hover:underline"
                      >
                        {i.establishmentName}
                      </Link>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {i.type}
                      </span>
                      <InspectionOutcomeBadge outcome={i.outcome} />
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" /> {i.officerName ?? "—"}
                      </span>
                      <span>·</span>
                      {i.scheduledFor ? <span>scheduled {fmtDateTime(i.scheduledFor)}</span> : null}
                      {i.conductedAt ? (
                        <>
                          <span>·</span>
                          <span>conducted {fmtDateTime(i.conductedAt)}</span>
                        </>
                      ) : null}
                    </p>
                    {i.notes ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={i.notes}>
                        {i.notes}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                </div>
              </div>
            ))}
          </div>
          {meta ? (
            <PaginationControls
              index={meta.current_page - 1}
              totalPages={meta.last_page}
              total={meta.total}
              pageSize={meta.per_page}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(meta.last_page, p + 1))}
            />
          ) : null}
        </>
      ) : (
        <RouteEmpty
          title="No inspections found"
          hint="Adjust the filters or schedule a new visit."
        />
      )}
    </SectionCard>
  );
}

function MyInspectionsTab() {
  const qc = useQueryClient();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.inspections.mine(),
    queryFn: inspectionsApi.mine,
  });
  const [logging, setLogging] = useState<Inspection | null>(null);
  const [outcome, setOutcome] = useState<InspectionOutcome>("Compliant");
  const [notes, setNotes] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (logging && loadedFor !== logging.id) {
    setLoadedFor(logging.id);
    setOutcome("Compliant");
    setNotes("");
  }

  const complete = useMutation({
    mutationFn: async () => {
      if (!logging) return Promise.reject(new Error("No inspection selected"));
      // Best-effort GPS — proves the officer was on site. Never blocks logging.
      const coords = await new Promise<{ latitude: number; longitude: number } | null>(
        (resolve) => {
          if (!("geolocation" in navigator)) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
          );
        },
      );
      return inspectionsApi.complete(logging.id, {
        outcome,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(coords ?? {}),
      });
    },
    onSuccess: () => {
      toast.success("Inspection outcome logged");
      setLogging(null);
      void qc.invalidateQueries({ queryKey: ["inspections"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const upcoming = (data ?? [])
    .filter((i) => !i.outcome)
    .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));

  const done = (data ?? []).filter((i) => i.outcome !== null);

  return (
    <>
      <SectionCard
        title="My inspections"
        description="Visits assigned to you. Log the outcome after each visit."
      >
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : upcoming.length ? (
          <ul className="divide-y divide-border">
            {upcoming.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{i.establishmentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.type} · scheduled {fmtDateTime(i.scheduledFor)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setLogging(i)}>
                  <ClipboardCheck className="size-4" /> Log outcome
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <RouteEmpty title="Nothing scheduled" hint="You have no upcoming inspections." />
        )}

        {done.length ? (
          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Completed</h3>
            <ul className="mt-2 divide-y divide-border">
              {done.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm">{i.establishmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.type} · {fmtDateTime(i.conductedAt)}
                    </p>
                  </div>
                  <InspectionOutcomeBadge outcome={i.outcome} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      <Dialog open={logging !== null} onOpenChange={(o) => !o && setLogging(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log outcome — {logging?.establishmentName}</DialogTitle>
            <DialogDescription>
              Record what you found on site. Your location is captured as on-site evidence. A
              critical finding flags the establishment for enforcement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="log-outcome">Outcome</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as InspectionOutcome)}>
              <SelectTrigger id="log-outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-notes">Notes (optional)</Label>
            <Textarea
              id="log-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observations, follow-ups required, evidence taken…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogging(null)}>
              Cancel
            </Button>
            <Button disabled={complete.isPending} onClick={() => complete.mutate()}>
              {complete.isPending ? "Saving…" : "Save outcome"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function localDatetimeMin() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function LogInspectionTab() {
  const qc = useQueryClient();
  const [venueSearch, setVenueSearch] = useState("");
  const debouncedVenue = useDebounced(venueSearch.trim(), 350);
  const [venue, setVenue] = useState<EstablishmentListItem | null>(null);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [type, setType] = useState<InspectionType>("Routine");
  const [outcome, setOutcome] = useState<InspectionOutcome>("Compliant");
  const [scheduledFor, setScheduledFor] = useState("");
  const [notes, setNotes] = useState("");
  const [formKey, setFormKey] = useState(0); // bump to reset the form on success

  const venues = useQuery({
    queryKey: ["insp-venues", debouncedVenue],
    queryFn: () =>
      establishmentsApi.all({
        page: 1,
        per_page: 30,
        ...(debouncedVenue ? { search: debouncedVenue } : {}),
      }),
  });

  const history = useQuery({
    queryKey: ["insp-history", venue?.id, formKey],
    queryFn: () => inspectionsApi.list({ establishmentId: venue!.id, per_page: 10 }),
    enabled: venue !== null,
  });

  const submit = useMutation({
    mutationFn: () =>
      mode === "now"
        ? inspectionsApi.adhoc({
            establishmentId: venue!.id,
            type,
            outcome,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          })
        : inspectionsApi.schedule({
            establishmentId: venue!.id,
            type,
            scheduledFor: new Date(scheduledFor).toISOString(),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          }),
    onSuccess: () => {
      toast.success(mode === "now" ? "Inspection logged" : "Inspection scheduled");
      setNotes("");
      setFormKey((k) => k + 1);
      void qc.invalidateQueries({ queryKey: ["inspections"] });
      void qc.invalidateQueries({ queryKey: ["insp-history"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const canSubmit =
    venue !== null &&
    (mode === "now" || scheduledFor !== "") &&
    (mode === "later" || notes.trim().length === 0 || notes.trim().length >= 5);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* ── Left — pick the venue ── */}
      <SectionCard
        title="1 · Pick the venue"
        description="The inspection attaches to this establishment's record."
      >
        {venue ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/50 bg-primary/[0.04] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="size-4.5 text-primary" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{venue.name}</p>
                <p className="text-xs text-muted-foreground">
                  {venue.type} · {venue.lga} · {venue.registrationNumber}
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setVenue(null)}>
              <ChevronLeft className="size-4" /> Change
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name or reg number…"
                value={venueSearch}
                onChange={(e) => setVenueSearch(e.target.value)}
              />
            </div>
            <div className="mt-3 grid max-h-[22rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {venues.isPending
                ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)
                : (venues.data?.data ?? []).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVenue(v)}
                      className="rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/60 hover:shadow-sm"
                    >
                      <p className="truncate text-sm font-semibold">{v.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="size-3" /> {v.lga} · {v.type}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground/80">
                        {v.registrationNumber}
                      </p>
                    </button>
                  ))}
            </div>
          </>
        )}

        {/* venue's inspection history once picked */}
        {venue ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Inspection history — {history.data?.meta.total ?? 0} on record
            </p>
            {history.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : history.data?.data.length ? (
              <ul className="space-y-1.5">
                {history.data.data.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs"
                  >
                    <span>
                      {i.type} · {fmtDateTime(i.conductedAt ?? i.scheduledFor)}
                      <span className="text-muted-foreground"> · {i.officerName ?? "—"}</span>
                    </span>
                    <InspectionOutcomeBadge outcome={i.outcome} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No inspections yet — this will be the first.
              </p>
            )}
          </div>
        ) : null}
      </SectionCard>

      {/* ── Right — the inspection itself ── */}
      <SectionCard
        title="2 · Record the inspection"
        description={
          mode === "now"
            ? "You visited the venue — log what you found."
            : "Schedule a visit for yourself or another officer."
        }
      >
        {/* mode toggle */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("now")}
            className={cn(
              "rounded-lg border p-3 text-left transition",
              mode === "now"
                ? "border-primary bg-primary/[0.05] ring-1 ring-primary/40"
                : "border-border hover:border-primary/40",
            )}
          >
            <ClipboardCheck className="mb-1 size-4 text-primary" />
            <p className="text-sm font-semibold">Log it now</p>
            <p className="text-[11px] text-muted-foreground">Inspection already done</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("later")}
            className={cn(
              "rounded-lg border p-3 text-left transition",
              mode === "later"
                ? "border-primary bg-primary/[0.05] ring-1 ring-primary/40"
                : "border-border hover:border-primary/40",
            )}
          >
            <CalendarPlus className="mb-1 size-4 text-primary" />
            <p className="text-sm font-semibold">Schedule it</p>
            <p className="text-[11px] text-muted-foreground">Plan a future visit</p>
          </button>
        </div>

        {/* type chips */}
        <div className="space-y-1.5">
          <Label>Inspection type</Label>
          <div className="grid grid-cols-2 gap-2">
            {INSPECTION_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition",
                  type === t.value
                    ? "border-primary bg-primary/[0.05] ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40",
                )}
              >
                <p className="text-xs font-semibold">{t.value}</p>
                <p className="text-[10px] text-muted-foreground">{t.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {mode === "now" ? (
          <div className="mt-3 space-y-1.5">
            <Label>Outcome</Label>
            <div className="grid grid-cols-3 gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                    outcome === o
                      ? o === "Compliant"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : o === "Issues"
                          ? "border-amber-500 bg-amber-50 text-amber-800"
                          : "border-rose-500 bg-rose-50 text-rose-800"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
            {outcome === "Critical" ? (
              <p className="text-[11px] font-medium text-rose-700">
                Critical findings flag the venue for enforcement and may suspend it.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="insp-when">Scheduled for</Label>
            <Input
              id="insp-when"
              type="datetime-local"
              min={localDatetimeMin()}
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>
        )}

        <div className="mt-3 space-y-1.5">
          <Label htmlFor="insp-notes">
            {mode === "now" ? "Findings / notes" : "Notes for the officer"}
          </Label>
          <Textarea
            id="insp-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              mode === "now"
                ? "Observations, evidence taken, follow-ups required…"
                : "What to check, complaint reference, access notes…"
            }
          />
        </div>

        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={!canSubmit || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending
            ? "Saving…"
            : mode === "now"
              ? `Log ${type.toLowerCase()} inspection`
              : "Schedule inspection"}
        </Button>
        {!venue ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Pick a venue on the left first.
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}
