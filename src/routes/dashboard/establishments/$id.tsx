import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  FileText,
  Receipt,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QueryError, RouteEmpty } from "@/components/common/route-states";
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
import { EstablishmentStatusBadge } from "@/components/common/status-badges";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { establishmentsApi, openMediaUrl, queryKeys } from "@/services";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import type { DocumentType, EstablishmentDetail } from "@/services";

export const Route = createFileRoute("/dashboard/establishments/$id")({
  component: EstablishmentDetailPage,
});

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  CacCertificate: "CAC certificate",
  GovernmentId: "Government ID",
  VenuePhoto: "Venue photo",
  UtilityBill: "Utility bill",
  Other: "Other",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function amenityList(e: EstablishmentDetail): string[] {
  const items: string[] = [];
  if (e.hasDj) items.push("DJ booth");
  if (e.hasVipArea) items.push("VIP area / bottle service");
  if (e.hasLiveBand) items.push("Live band");
  if (e.hasPoolTable) items.push("Pool table");
  if (e.hasShisha) items.push("Shisha");
  if (e.hasRooftop) items.push("Rooftop / terrace");
  if (e.hasRestaurant) items.push("Restaurant");
  if (e.hasOutdoorSpace) items.push("Outdoor space");
  if (e.hasLodging) items.push("Lodging");
  if (e.hasParking) items.push(e.parkingSpaces ? `Parking (${e.parkingSpaces} spaces)` : "Parking");
  return items;
}

function DocumentUpload({ establishmentId }: { establishmentId: string }) {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState<DocumentType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadCount, setUploadCount] = useState(0); // remounts the input so re-picking the same file works

  const upload = useMutation({
    mutationFn: () => {
      if (!file || !docType) throw new Error("Choose a document type and a file");
      return establishmentsApi.uploadDocument(establishmentId, file, docType);
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      setFile(null);
      setUploadCount((n) => n + 1);
      setDocType("");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.establishments.byId(establishmentId),
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
  });

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
      <div className="w-full sm:w-56">
        <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
          <SelectTrigger>
            <SelectValue placeholder="Document type" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {DOC_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        key={uploadCount}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sm:max-w-xs"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        size="sm"
        disabled={!file || !docType || upload.isPending}
        onClick={() => upload.mutate()}
      >
        <Upload className="size-4" />
        {upload.isPending ? "Uploading…" : "Upload"}
      </Button>
    </div>
  );
}

function EstablishmentDetailPage() {
  const { id } = Route.useParams();
  const detail = useQuery({
    queryKey: queryKeys.establishments.byId(id),
    queryFn: () => establishmentsApi.getById(id),
  });

  const e = detail.data;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [withdrawing, setWithdrawing] = useState(false);
  const [closing, setClosing] = useState(false);

  const withdraw = useMutation({
    mutationFn: () => establishmentsApi.withdraw(id),
    onSuccess: () => {
      toast.success("Application withdrawn");
      void queryClient.invalidateQueries({ queryKey: queryKeys.establishments.mine() });
      void navigate({ to: "/dashboard/establishments" });
    },
    onError: (err: Error) => toast.error(err.message || "Could not withdraw the application"),
  });

  const close = useMutation({
    mutationFn: () => establishmentsApi.close(id),
    onSuccess: () => {
      toast.success("Establishment deregistered — certificates revoked");
      void queryClient.invalidateQueries({ queryKey: queryKeys.establishments.byId(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.establishments.mine() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.certificates.mine() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.levies.mine() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.fines.mine() });
    },
    onError: (err: Error) => toast.error(err.message || "Could not close the establishment"),
  });

  return (
    <div className="px-4 py-6 sm:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/dashboard/establishments">
          <ArrowLeft className="size-4" /> Back to establishments
        </Link>
      </Button>

      {detail.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : detail.isError ? (
        <QueryError error={detail.error} onRetry={() => void detail.refetch()} />
      ) : !e ? (
        <RouteEmpty
          title="Establishment not found"
          hint="It may have been removed or the link is incorrect."
        />
      ) : (
        <div className="space-y-6">
          <AlertDialog open={withdrawing} onOpenChange={setWithdrawing}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Withdraw this application?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the application for "{e.name}" ({e.registrationNumber})
                  and its uploaded documents. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep application</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate()}
                >
                  {withdraw.isPending ? "Withdrawing…" : "Withdraw application"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={closing} onOpenChange={setClosing}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close {e.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  The venue will be marked as deregistered and any active certificates will be
                  revoked — they will fail public verification. Outstanding levies or fines remain
                  payable. Reopening requires re-application and inspection.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep open</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={close.isPending}
                  onClick={() => close.mutate()}
                >
                  {close.isPending ? "Closing…" : "Close venue"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Card>
            <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-xl font-semibold">{e.name}</h2>
                  <EstablishmentStatusBadge status={e.status} />
                </div>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {e.registrationNumber}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[e.type, ...e.additionalTypes].join(" + ")} · {e.lga}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/dashboard/levies">
                    <Receipt className="size-4" /> View levies
                  </Link>
                </Button>
                {e.status === "PendingReview" || e.status === "Rejected" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setWithdrawing(true)}
                  >
                    <Trash2 className="size-4" /> Withdraw
                  </Button>
                ) : null}
                {e.status === "Approved" ||
                e.status === "Suspended" ||
                e.status === "NonCompliant" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setClosing(true)}
                  >
                    <XCircle className="size-4" /> Close venue
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {e.status === "Rejected" && e.rejectionReason ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="flex items-start gap-3 pt-5">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold">Application rejected</p>
                  <p className="text-sm text-muted-foreground">{e.rejectionReason}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <SectionCard title="Details" description="Information submitted during registration">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Type" value={e.type} />
              <Field
                label="Also operates as"
                value={e.additionalTypes.length ? e.additionalTypes.join(", ") : null}
              />
              <Field label="LGA" value={e.lga} />
              <Field label="Tier" value={e.tierName} />
              <Field label="Address" value={e.address} />
              <Field label="Landmark" value={e.landmark} />
              <Field
                label="Coordinates"
                value={
                  e.latitude != null && e.longitude != null
                    ? `${e.latitude.toFixed(5)}, ${e.longitude.toFixed(5)}`
                    : null
                }
              />
              <Field label="Operating hours" value={e.operatingHours} />
              <Field label="Phone" value={e.contactPhone} />
              <Field label="Email" value={e.contactEmail} />
              <Field label="CAC number" value={e.cacNumber} />
              <Field label="Owner NIN" value={e.ownerNin} />
              <Field label="Capacity" value={e.capacity.toLocaleString()} />
              <Field label="Staff count" value={String(e.staffCount)} />
              <Field label="Floor area" value={e.floorAreaSqm ? `${e.floorAreaSqm} m²` : null} />
            </dl>
            {e.description ? (
              <p className="mt-4 text-sm text-muted-foreground">{e.description}</p>
            ) : null}
            <div className="mt-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Amenities</p>
              {amenityList(e).length ? (
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {amenityList(e).map((a) => (
                    <li
                      key={a}
                      className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">None listed.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Documents"
            description="Supporting documents for your application (CAC certificate, ID, venue photos)"
          >
            {e.documents.length ? (
              <ul className="divide-y divide-border">
                {e.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{DOC_TYPE_LABELS[d.documentType]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {d.fileName ?? d.fileUrl} · uploaded {fmtDateTime(d.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    {d.fileUrl ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() =>
                          void openMediaUrl(d.fileUrl).catch(() =>
                            toast.error("Couldn't open file"),
                          )
                        }
                      >
                        <ExternalLink className="size-4" /> View
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <RouteEmpty
                title="No documents yet"
                hint="Upload your CAC certificate or venue photos to speed up review."
              />
            )}
            <DocumentUpload establishmentId={e.id} />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
