import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  DoorClosed,
  ExternalLink,
  FileText,
  RefreshCcw,
  ShieldBan,
  ShieldCheck,
  Undo2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QueryError, RouteEmpty } from "@/components/common/route-states";
import {
  EstablishmentStatusBadge,
  formatNaira,
  InspectionOutcomeBadge,
  Pill,
} from "@/components/common/status-badges";
import { SectionCard } from "@/components/layout/dashboard-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  canEnforce,
  canReview,
  certificatesApi,
  complaintsApi,
  establishmentsApi,
  finesApi,
  leviesApi,
  inspectionsApi,
  queryKeys,
  openMediaUrl,
  tiersApi,
} from "@/services";
import type {
  EstablishmentDetail,
  EstablishmentDocument,
  Inspection,
  InspectionType,
  LicenseTier,
} from "@/services";

function localDatetimeMin() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export const Route = createFileRoute("/admin/establishments/$id")({
  component: EstablishmentReviewPage,
});

const INSPECTION_TYPES: InspectionType[] = ["Registration", "Routine", "Complaint", "Enforcement"];
const FINE_TYPES = ["UnlicensedOperation", "ExpiredCertificate", "FailedInspection", "Other"];

const DOCUMENT_LABELS: Record<string, string> = {
  CacCertificate: "CAC certificate",
  GovernmentId: "Government ID",
  VenuePhoto: "Venue photo",
  UtilityBill: "Utility bill",
  Other: "Other",
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-NG");
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-NG");
}

function EstablishmentReviewPage() {
  const { id } = Route.useParams();
  const { session } = useAuth();

  const detail = useQuery({
    queryKey: queryKeys.establishments.byId(id),
    queryFn: () => establishmentsApi.getById(id),
  });
  const inspections = useQuery({
    queryKey: ["inspections", "establishment", id],
    queryFn: () => establishmentsApi.inspections(id),
  });
  const tiers = useQuery({ queryKey: queryKeys.tiers.list(), queryFn: tiersApi.list });
  const levies = useQuery({
    queryKey: ["levies", "establishment", id],
    queryFn: () => leviesApi.all({ establishment_id: id, per_page: 20 }),
  });
  const fines = useQuery({
    queryKey: ["fines", "establishment", id],
    queryFn: () => finesApi.list({ establishmentId: id, per_page: 20 }),
  });
  const certs = useQuery({
    queryKey: ["certificates", "establishment", id],
    queryFn: () => certificatesApi.list({ establishment_id: id, per_page: 10 }),
  });
  const complaints = useQuery({
    queryKey: ["complaints", "establishment", id],
    queryFn: () => complaintsApi.list({ establishmentId: id }),
  });

  const e = detail.data;
  const reviewer = canReview(session?.role);
  const enforcer = canEnforce(session?.role);

  if (detail.isPending) {
    return (
      <div className="px-4 py-6 sm:px-8">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-40 w-full" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <div className="px-4 py-6 sm:px-8">
        <QueryError error={detail.error} onRetry={() => void detail.refetch()} />
      </div>
    );
  }

  if (!e) {
    return (
      <div className="px-4 py-6 sm:px-8">
        <RouteEmpty title="Establishment not found" hint="It may have been removed." />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link to="/admin/establishments">
          <ArrowLeft className="size-4" /> Back to establishments
        </Link>
      </Button>

      <SectionCard
        title={e.name}
        description={`${e.registrationNumber} · ${[e.type, ...e.additionalTypes].join(" + ")} · ${e.lga} LGA`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <EstablishmentStatusBadge status={e.status} />
            {e.status === "NonCompliant" && e.nonCompliantReason ? (
              <span className="text-xs text-muted-foreground">
                flagged:{" "}
                {e.nonCompliantReason === "UnpaidLevy"
                  ? "unpaid levy"
                  : e.nonCompliantReason === "CriticalInspection"
                    ? "critical inspection"
                    : "certificate revoked"}
              </span>
            ) : null}
            {reviewer && e.status === "PendingReview" ? (
              <>
                <ApproveDialog id={id} detail={e} tiers={tiers.data ?? []} />
                <RejectDialog id={id} />
              </>
            ) : null}
            {reviewer && e.status === "Approved" ? (
              <>
                <ReclassifyDialog id={id} tiers={tiers.data ?? []} />
                <SuspendDialog id={id} />
                {session?.role === "Admin" ? <AdminCloseDialog id={id} /> : null}
              </>
            ) : null}
            {reviewer && e.status === "Suspended" ? (
              <>
                <ReinstateDialog id={id} />
                {session?.role === "Admin" ? <AdminCloseDialog id={id} /> : null}
              </>
            ) : null}
            {reviewer && e.status === "NonCompliant" ? (
              <>
                <ClearComplianceButton id={id} />
                {session?.role === "Admin" ? <AdminCloseDialog id={id} /> : null}
              </>
            ) : null}
            {enforcer && e.status !== "Closed" && e.status !== "Rejected" ? (
              <ScheduleInspectionDialog id={id} />
            ) : null}
            {session?.role === "Admin" &&
            ["Approved", "Suspended", "NonCompliant"].includes(e.status) ? (
              <IssueFineDialog id={id} />
            ) : null}
          </div>
        }
      >
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Description" value={e.description ?? "—"} wide />
          <Info label="Address" value={e.address} wide />
          <Info label="Landmark" value={e.landmark ?? "—"} />
          <Info
            label="Coordinates"
            value={
              e.latitude != null && e.longitude != null
                ? `${e.latitude.toFixed(5)}, ${e.longitude.toFixed(5)}`
                : "—"
            }
          />
          <Info label="Contact phone" value={e.contactPhone} />
          <Info label="Contact email" value={e.contactEmail ?? "—"} />
          <Info label="CAC number" value={e.cacNumber ?? "—"} />
          <Info label="Owner NIN" value={e.ownerNin ?? "—"} />
          <Info label="Capacity" value={String(e.capacity)} />
          <Info label="Staff count" value={String(e.staffCount)} />
          <Info label="Floor area" value={e.floorAreaSqm != null ? `${e.floorAreaSqm} m²` : "—"} />
          <Info
            label="Parking"
            value={
              e.hasParking
                ? `Yes${e.parkingSpaces != null ? ` (${e.parkingSpaces} spaces)` : ""}`
                : "No"
            }
          />
          <Info label="Operating hours" value={e.operatingHours ?? "—"} />
          <Info
            label="Suggested tier"
            value={
              e.suggestedTierScore != null
                ? `Score ${e.suggestedTierScore}${e.tierName ? ` — ${e.tierName}` : ""}`
                : (e.tierName ?? "—")
            }
          />
          <Info label="Owner" value={e.ownerName ?? "—"} />
          <Info label="Owner email" value={e.ownerEmail ?? "—"} />
          <Info label="Registered" value={fmtDateTime(e.createdAt)} />
          <Info label="Approved" value={fmtDateTime(e.approvedAt)} />
          {e.rejectionReason ? (
            <Info label="Rejection reason" value={e.rejectionReason} wide />
          ) : null}
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          {(
            [
              ["DJ booth", e.hasDj],
              ["VIP / bottle service", e.hasVipArea],
              ["Live band", e.hasLiveBand],
              ["Pool table", e.hasPoolTable],
              ["Shisha", e.hasShisha],
              ["Rooftop", e.hasRooftop],
              ["Restaurant", e.hasRestaurant],
              ["Outdoor space", e.hasOutdoorSpace],
              ["Lodging", e.hasLodging],
              ["Parking", e.hasParking],
            ] as const
          ).map(([label, on]) => (
            <Pill key={label} tone={on ? "info" : "neutral"}>
              {on ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
              {label}
            </Pill>
          ))}
        </div>
      </SectionCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Documents" description="Submitted with the application.">
          {e.documents.length ? (
            <ul className="divide-y divide-border">
              {e.documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </ul>
          ) : (
            <RouteEmpty title="No documents" hint="The owner has not uploaded any files." />
          )}
        </SectionCard>

        <SectionCard title="Inspection history" description="Past and scheduled inspections.">
          {inspections.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : inspections.isError ? (
            <QueryError error={inspections.error} onRetry={() => void inspections.refetch()} />
          ) : inspections.data?.length ? (
            <ul className="divide-y divide-border">
              {inspections.data.map((i) => (
                <InspectionRow key={i.id} inspection={i} />
              ))}
            </ul>
          ) : (
            <RouteEmpty
              title="No inspections"
              hint="Schedule one from the actions above when required."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Certificates"
          description="Compliance certificates issued to this venue."
        >
          {certs.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : certs.data?.data.length ? (
            <ul className="divide-y divide-border">
              {certs.data.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-semibold">
                      {c.certificateNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.levyYear} levy · issued {fmtDate(c.issueDate)} · expires{" "}
                      {fmtDate(c.expiryDate)}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[11px]">
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <RouteEmpty title="No certificates" hint="Issued automatically on levy payment." />
          )}
        </SectionCard>

        <SectionCard
          title="Financial record"
          description="Annual levies and enforcement fines billed to this venue."
        >
          {levies.isPending || fines.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Levies
                </p>
                {levies.data?.data.length ? (
                  <ul className="divide-y divide-border">
                    {levies.data.data.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-2 py-1.5 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {l.year} · {l.tierName}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-medium">{formatNaira(l.amount)}</span>
                          <Badge variant="outline" className="text-[11px]">
                            {l.status}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">None yet.</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Fines
                </p>
                {fines.data?.data.length ? (
                  <ul className="divide-y divide-border">
                    {fines.data.data.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center justify-between gap-2 py-1.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate">{f.fineType}</p>
                          <p className="truncate text-xs text-muted-foreground">{f.reason}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-xs font-medium">{formatNaira(f.amount)}</span>
                          <Badge variant="outline" className="text-[11px]">
                            {f.status}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">None.</p>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Resident complaints"
          description="Reports filed by the public about this venue."
        >
          {complaints.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : complaints.data?.data.length ? (
            <ul className="divide-y divide-border">
              {complaints.data.data.map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {c.category === "UnderageEntry"
                        ? "Underage"
                        : c.category === "UnlicensedOperation"
                          ? "Unlicensed"
                          : c.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(c.createdAt)} · {c.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.details}</p>
                </li>
              ))}
            </ul>
          ) : (
            <RouteEmpty
              title="No complaints"
              hint="Public reports linked to this venue appear here."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

function DocumentRow({ doc }: { doc: EstablishmentDocument }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {DOCUMENT_LABELS[doc.documentType] ?? doc.documentType}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {doc.fileName ?? "Uploaded file"} · {fmtDate(doc.uploadedAt)}
          </p>
        </div>
      </div>
      {doc.fileUrl ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void openMediaUrl(doc.fileUrl).catch(() => toast.error("Couldn't open file"))
          }
        >
          <ExternalLink className="size-3.5" /> View
        </Button>
      ) : null}
    </li>
  );
}

function InspectionRow({ inspection }: { inspection: Inspection }) {
  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{inspection.type} inspection</p>
          <p className="text-xs text-muted-foreground">
            {inspection.outcome
              ? `Conducted ${fmtDateTime(inspection.conductedAt)}`
              : `Scheduled ${fmtDateTime(inspection.scheduledFor)}`}
            {" · "}
            {inspection.officerName}
          </p>
        </div>
        <InspectionOutcomeBadge outcome={inspection.outcome} />
      </div>
      {inspection.notes ? (
        <p className="mt-1 text-xs text-muted-foreground">{inspection.notes}</p>
      ) : null}
    </li>
  );
}

/* ---------------------------------- dialogs --------------------------------- */

function ApproveDialog({
  id,
  detail,
  tiers,
}: {
  id: string;
  detail: EstablishmentDetail;
  tiers: LicenseTier[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tierId, setTierId] = useState("");
  const [notes, setNotes] = useState("");

  const activeTiers = tiers.filter((t) => t.isActive !== false);
  const suggested =
    detail.suggestedTierScore != null
      ? [...activeTiers]
          .filter((t) => detail.suggestedTierScore! >= t.minScore)
          .sort((a, b) => b.minScore - a.minScore)[0]
      : undefined;

  const approve = useMutation({
    mutationFn: () => establishmentsApi.approve(id, tierId, notes.trim() || undefined),
    onSuccess: (r) => {
      toast.success(
        `Approved — assigned ${r.tierName}${r.levyAmount ? ` · levy ${formatNaira(r.levyAmount)}` : ""}`,
      );
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["establishments"] });
      void qc.invalidateQueries({ queryKey: ["levies"] });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck className="size-4" /> Approve &amp; assign tier
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {detail.name}</DialogTitle>
            <DialogDescription>
              Assign a license tier. An annual levy assessment is generated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-brand/40 bg-[var(--brand-tint-soft)] px-3 py-2 text-sm">
            Suggested tier score:{" "}
            <b className="font-display text-base">{detail.suggestedTierScore ?? "n/a"}</b>
            {suggested ? (
              <span className="ml-2 text-muted-foreground">closest match: {suggested.name}</span>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approve-tier">License tier</Label>
            <Select value={tierId} onValueChange={setTierId}>
              <SelectTrigger id="approve-tier">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {activeTiers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — {formatNaira(t.annualFee)}/yr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approve-notes">Notes (optional)</Label>
            <Textarea
              id="approve-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this approval"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!tierId || approve.isPending} onClick={() => approve.mutate()}>
              {approve.isPending ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RejectDialog({ id }: { id: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const reject = useMutation({
    mutationFn: () => establishmentsApi.reject(id, reason.trim()),
    onSuccess: () => {
      toast.success("Application rejected");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["establishments"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        <XCircle className="size-4" /> Reject
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject application</DialogTitle>
            <DialogDescription>
              The owner will be notified. Provide a clear reason (minimum 10 characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. CAC certificate is illegible — re-upload and reapply."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 10 || reject.isPending}
              onClick={() => reject.mutate()}
            >
              {reject.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReclassifyDialog({ id, tiers }: { id: string; tiers: LicenseTier[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tierId, setTierId] = useState("");
  const [reason, setReason] = useState("");

  const reclassify = useMutation({
    mutationFn: () => establishmentsApi.reclassifyTier(id, tierId, reason.trim()),
    onSuccess: () => {
      toast.success("Tier updated");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["establishments"] });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <RefreshCcw className="size-4" /> Reclassify tier
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reclassify tier</DialogTitle>
            <DialogDescription>
              Change the license tier. A reason is required for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reclass-tier">New tier</Label>
            <Select value={tierId} onValueChange={setTierId}>
              <SelectTrigger id="reclass-tier">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {tiers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — {formatNaira(t.annualFee)}/yr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reclass-reason">Reason</Label>
            <Textarea
              id="reclass-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!tierId || !reason.trim() || reclassify.isPending}
              onClick={() => reclassify.mutate()}
            >
              {reclassify.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SuspendDialog({ id }: { id: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const suspend = useMutation({
    mutationFn: () => establishmentsApi.suspend(id, reason.trim()),
    onSuccess: () => {
      toast.success("Establishment suspended");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["establishments"] });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        <ShieldBan className="size-4" /> Suspend
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend establishment</DialogTitle>
            <DialogDescription>
              Suspended establishments cannot operate legally until reinstated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="suspend-reason">Reason</Label>
            <Textarea
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || suspend.isPending}
              onClick={() => suspend.mutate()}
            >
              {suspend.isPending ? "Suspending…" : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReinstateDialog({ id }: { id: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const reinstate = useMutation({
    mutationFn: () => establishmentsApi.reinstate(id, notes.trim() || undefined),
    onSuccess: () => {
      toast.success("Suspension lifted — establishment approved again");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["establishments"] });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Undo2 className="size-4" /> Reinstate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reinstate establishment</DialogTitle>
            <DialogDescription>
              The venue returns to Approved and can operate. Certificates revoked during suspension
              stay revoked — a new levy must be settled for a fresh certificate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reinstate-notes">Notes (optional)</Label>
            <Textarea
              id="reinstate-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={reinstate.isPending} onClick={() => reinstate.mutate()}>
              {reinstate.isPending ? "Reinstating…" : "Reinstate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AdminCloseDialog({ id }: { id: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const close = useMutation({
    mutationFn: () => establishmentsApi.close(id, reason.trim()),
    onSuccess: () => {
      toast.success("Establishment closed");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["establishments"] });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <DoorClosed className="size-4" /> Close venue
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close venue</DialogTitle>
            <DialogDescription>
              Closes this establishment permanently — active certificates are revoked and financial
              history is preserved. Only do this when the venue has actually ceased operations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="close-reason">Reason</Label>
            <Textarea
              id="close-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Venue shut down by enforcement order"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || close.isPending}
              onClick={() => close.mutate()}
            >
              {close.isPending ? "Closing…" : "Close venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ScheduleInspectionDialog({ id }: { id: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<InspectionType>("Routine");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");

  const schedule = useMutation({
    mutationFn: () =>
      inspectionsApi.schedule({
        establishmentId: id,
        type,
        scheduledFor: new Date(when).toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success("Inspection scheduled");
      setOpen(false);
      setWhen("");
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["inspections"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" /> Schedule inspection
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule inspection</DialogTitle>
            <DialogDescription>Assign a site visit for this establishment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="insp-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as InspectionType)}>
              <SelectTrigger id="insp-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSPECTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insp-when">Date &amp; time</Label>
            <Input
              id="insp-when"
              type="datetime-local"
              min={localDatetimeMin()}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insp-notes">Notes (optional)</Label>
            <Textarea id="insp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!when || schedule.isPending} onClick={() => schedule.mutate()}>
              {schedule.isPending ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IssueFineDialog({ id }: { id: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fineType, setFineType] = useState(FINE_TYPES[0] ?? "Other");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const issue = useMutation({
    mutationFn: () =>
      finesApi.issue({
        establishmentId: id,
        fineType,
        amount: Number(amount),
        reason: reason.trim(),
      }),
    onSuccess: (r) => {
      toast.success(`Fine ${r.reference} issued — ${formatNaira(r.amount)}`);
      setOpen(false);
      setAmount("");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["fines"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const parsedAmount = Number(amount);
  const valid = reason.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ShieldBan className="size-4" /> Issue fine
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue fine</DialogTitle>
            <DialogDescription>
              The fine is billed to the establishment and must be paid before renewal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="fine-type">Fine type</Label>
            <Select value={fineType} onValueChange={setFineType}>
              <SelectTrigger id="fine-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/([a-z])([A-Z])/g, "$1 $2")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fine-amount">Amount (₦)</Label>
            <Input
              id="fine-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fine-reason">Reason</Label>
            <Textarea id="fine-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!valid || issue.isPending} onClick={() => issue.mutate()}>
              {issue.isPending ? "Issuing…" : "Issue fine"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClearComplianceButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const clear = useMutation({
    mutationFn: () => establishmentsApi.clearCompliance(id),
    onSuccess: () => {
      toast.success("Compliance flag cleared");
      void qc.invalidateQueries({ queryKey: queryKeys.establishments.byId(id) });
      void qc.invalidateQueries({ queryKey: ["establishments"] });
      void qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not clear"),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={clear.isPending}>
          <BadgeCheck className="size-4" /> Clear flag
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear the non-compliance flag?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirms the underlying issue is resolved and restores the venue to Approved. Any
            overdue levies must be settled first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction onClick={() => clear.mutate()}>Clear flag</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
