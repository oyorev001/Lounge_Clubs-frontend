import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  FileBadge,
  FileText,
  MoreHorizontal,
  RotateCcw,
  Search,
  ShieldBan,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Pill } from "@/components/common/status-badges";
import { cn } from "@/lib/utils";
import { Building2, CalendarDays } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaginationControls } from "@/components/common/pagination";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  canReview,
  certificatesApi,
  exportsApi,
  queryKeys,
  saveBlobAs,
  tiersApi,
} from "@/services";
import { fmtDate } from "@/lib/dates";
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
import { useDebounced } from "@/hooks/use-debounced";
import type { Certificate, CertificateStatus, VerifyCertificateResult } from "@/services";

export const Route = createFileRoute("/admin/certificates")({ component: CertificatesPage });

const ALL = "__all__";
const PAGE_SIZE = 12;
const STATUSES: CertificateStatus[] = ["Active", "Expired", "Revoked"];

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

function CertificatesPage() {
  const { session } = useAuth();
  const canRevoke = canReview(session?.role);
  const qc = useQueryClient();

  // Verify box (same public check)
  const [number, setNumber] = useState("");
  const [result, setResult] = useState<VerifyCertificateResult | null>(null);

  // List filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CertificateStatus | typeof ALL>(ALL);
  const [quick, setQuick] = useState<"" | "expiring" | "new">("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim());

  // Revoke dialog — id comes from the selected row
  const [reason, setReason] = useState("");
  // unified status action — target status + cert
  const [statusAction, setStatusAction] = useState<{
    cert: Certificate;
    to: "Active" | "Expired" | "Revoked";
  } | null>(null);

  const tiers = useQuery({ queryKey: ["tiers"], queryFn: tiersApi.list });

  const certs = useQuery({
    queryKey: ["admin", "certificates", { search: debouncedSearch, status, quick, tier, page }],
    queryFn: () =>
      certificatesApi.list({
        page,
        per_page: PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(status !== ALL ? { status } : {}),
        ...(quick === "expiring" ? { expiring_in_days: 30 } : {}),
        ...(quick === "new" ? { issued_within_days: 30 } : {}),
        ...(tier ? { tier } : {}),
      }),
  });

  const verify = useMutation({
    mutationFn: (n: string) => certificatesApi.verify(n),
    onSuccess: setResult,
    onError: (e) => {
      setResult(null);
      toast.error(errMsg(e));
    },
  });

  const statusMut = useMutation({
    mutationFn: () =>
      certificatesApi.setStatus(statusAction!.cert.id, statusAction!.to, reason.trim()),
    onSuccess: (r) => {
      toast.success(`${r.certificateNumber} → ${r.status}`);
      setStatusAction(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin", "certificates"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const statusTone = (s?: string) =>
    s === "Active" ? "positive" : s === "Expired" ? "warning" : "danger";

  const meta = certs.data?.meta;

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Certificate verification"
        description="Look up any certificate by its number — same check the public portal uses."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void exportsApi
                .certificates()
                .then(saveBlobAs)
                .catch(() => toast.error("Export failed"))
            }
          >
            Export CSV
          </Button>
        }
      >
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (number.trim()) verify.mutate(number.trim());
          }}
        >
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Certificate number e.g. OYS-LC-2026-000001"
              className="pl-8"
            />
          </div>
          <Button type="submit" disabled={!number.trim() || verify.isPending}>
            {verify.isPending ? "Verifying…" : "Verify"}
          </Button>
        </form>

        {result ? (
          <div className="mt-6 rounded-lg border border-border p-4">
            {!result.found ? (
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold">Certificate not found</p>
                  <p className="text-sm text-muted-foreground">
                    No certificate matches that number. Check for typos or a forged document.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileBadge className="size-5 text-brand" />
                    <p className="font-mono font-semibold">{result.certificateNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={result.isValid ? "positive" : "danger"}>
                      {result.isValid ? "Valid" : "Invalid"}
                    </Pill>
                    {result.status ? (
                      <Pill tone={statusTone(result.status)}>{result.status}</Pill>
                    ) : null}
                  </div>
                </div>
                <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Establishment" value={result.establishmentName} />
                  <Field label="Type" value={result.establishmentType} />
                  <Field label="LGA" value={result.lga} />
                  <Field label="Tier" value={result.tierName} />
                  <Field
                    label="Levy year"
                    value={result.levyYear != null ? String(result.levyYear) : undefined}
                  />
                  <Field label="Issued" value={fmtDate(result.issueDate)} />
                  <Field label="Expires" value={fmtDate(result.expiryDate)} />
                </dl>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            Enter a certificate number above to confirm its authenticity and current status.
          </div>
        )}
      </SectionCard>

      <div className="mt-6">
        <SectionCard
          title="All certificates"
          description="Every certificate the system has issued — search, filter and revoke."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Number or venue name"
                  className="pl-8 sm:w-56"
                />
              </div>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as CertificateStatus | typeof ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger className="sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={tier}
                onValueChange={(v) => {
                  setTier(v === ALL ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="All tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All tiers</SelectItem>
                  {(tiers.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          {/* quick views — expiring / newly issued */}
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                { k: "", l: "All" },
                { k: "expiring", l: "Expiring in 30 days" },
                { k: "new", l: "Issued last 30 days" },
              ] as const
            ).map((f) => (
              <button
                key={f.k}
                type="button"
                onClick={() => {
                  setQuick(f.k);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                  quick === f.k
                    ? "bg-foreground text-background ring-foreground"
                    : "bg-muted/60 text-muted-foreground ring-border hover:bg-muted"
                }`}
              >
                {f.l}
              </button>
            ))}
            {quick === "expiring" ? (
              <span className="self-center text-[11px] text-muted-foreground">
                renewal follow-ups live here
              </span>
            ) : null}
          </div>
          {certs.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : certs.isError ? (
            <QueryError error={certs.error} onRetry={() => void certs.refetch()} />
          ) : certs.data && certs.data.data.length > 0 ? (
            <>
              <div className="space-y-2">
                {certs.data.data.map((c) => {
                  const daysLeft = Math.ceil(
                    (new Date(c.expiryDate).getTime() - Date.now()) / 86_400_000,
                  );
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "rounded-lg border border-border bg-card px-4 py-3 transition hover:border-primary/50",
                        c.status === "Revoked" && "border-l-4 border-l-rose-500",
                        c.status === "Expired" && "border-l-4 border-l-muted-foreground/40",
                        c.status === "Active" &&
                          (daysLeft <= 30
                            ? "border-l-4 border-l-amber-400"
                            : "border-l-4 border-l-emerald-500"),
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-xs font-bold">{c.certificateNumber}</p>
                            <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                            {c.status === "Active" && daysLeft <= 30 ? (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                {daysLeft > 0 ? `${daysLeft}d left` : "expires today"}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{c.establishmentName}</span>
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                            <span>{c.tierName ?? "—"}</span>
                            <span>·</span>
                            <span>{c.levyYear} levy</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <CalendarDays className="size-3" />
                              {fmtDate(c.issueDate)} → {fmtDate(c.expiryDate)}
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Download PDF"
                            onClick={() =>
                              void certificatesApi
                                .pdf(c.id)
                                .then(saveBlobAs)
                                .catch(() => toast.error("Could not download PDF"))
                            }
                          >
                            <FileText className="size-4" />
                          </Button>
                          {canRevoke ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" title="Certificate actions">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {c.status === "Active" ? (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setReason("");
                                        setStatusAction({ cert: c, to: "Revoked" });
                                      }}
                                    >
                                      <ShieldBan className="size-4 text-destructive" /> Revoke
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setReason("");
                                        setStatusAction({ cert: c, to: "Expired" });
                                      }}
                                    >
                                      <XCircle className="size-4" /> Mark expired
                                    </DropdownMenuItem>
                                  </>
                                ) : c.status === "Revoked" ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setReason("");
                                      setStatusAction({ cert: c, to: "Active" });
                                    }}
                                  >
                                    <RotateCcw className="size-4 text-emerald-600" /> Reinstate
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem disabled>
                                    Expired — renewal issues a new cert
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {meta && meta.last_page > 1 ? (
                <div className="mt-4">
                  <PaginationControls
                    index={meta.current_page - 1}
                    totalPages={meta.last_page}
                    total={meta.total}
                    pageSize={meta.per_page}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <RouteEmpty title="No certificates found" hint="Try a different search or filter." />
          )}
        </SectionCard>
      </div>

      {/* Status transition — required reason, audited */}
      <Dialog
        open={statusAction !== null}
        onOpenChange={(o) => {
          if (!o) {
            setStatusAction(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusAction?.to === "Active"
                ? "Reinstate"
                : statusAction?.to === "Revoked"
                  ? "Revoke"
                  : "Mark expired"}{" "}
              {statusAction?.cert.certificateNumber}?
            </DialogTitle>
            <DialogDescription>
              {statusAction?.to === "Active"
                ? "The certificate becomes valid for public verification again and the venue's compliance flag lifts."
                : statusAction?.to === "Revoked"
                  ? "The certificate fails public verification immediately and the venue is flagged non-compliant if no other active certificate remains."
                  : "The certificate stops being valid — renewal requires a new levy payment."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="status-reason">Reason (required)</Label>
            <Textarea
              id="status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                statusAction?.to === "Active"
                  ? "e.g. Revocation was an error — venue compliant after re-inspection"
                  : "e.g. Establishment shut down by enforcement order"
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusAction(null)}>
              Cancel
            </Button>
            <Button
              variant={statusAction?.to === "Active" ? "default" : "destructive"}
              disabled={reason.trim().length < 5 || statusMut.isPending}
              onClick={() => statusMut.mutate()}
            >
              {statusMut.isPending ? "Updating…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | undefined }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? "—"}</dd>
    </div>
  );
}
