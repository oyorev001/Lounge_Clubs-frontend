import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Factory } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PaginationControls } from "@/components/common/pagination";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { formatNaira, LevyStatusBadge } from "@/components/common/status-badges";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useDebounced } from "@/hooks/use-debounced";
import { OYO_LGAS } from "@/lib/oyo";
import {
  canFinance,
  exportsApi,
  isAdmin,
  leviesApi,
  paymentsApi,
  queryKeys,
  saveBlobAs,
} from "@/services";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import type { LevyAssessment, LevyStatus } from "@/services";

export const Route = createFileRoute("/admin/levies")({ component: LeviesPage });

const ALL = "all";
const PAGE_SIZE = 15;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR + 2 - i);
const STATUS_OPTIONS: LevyStatus[] = ["Pending", "Paid", "Overdue", "Waived"];

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

function LeviesPage() {
  const { session } = useAuth();
  const admin = isAdmin(session?.role);

  return (
    <div className="px-4 py-6 sm:px-8">
      <Tabs defaultValue="assessments">
        <TabsList>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          {canFinance(session?.role) ? (
            <TabsTrigger value="manual">Manual payments</TabsTrigger>
          ) : null}
          {admin ? <TabsTrigger value="generate">Generate</TabsTrigger> : null}
          {admin ? <TabsTrigger value="recon">Reconciliation</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="assessments" className="mt-4">
          <AssessmentsTab canWaive={canFinance(session?.role)} />
        </TabsContent>
        {canFinance(session?.role) ? (
          <TabsContent value="manual" className="mt-4">
            <ManualPaymentsTab />
          </TabsContent>
        ) : null}
        {admin ? (
          <TabsContent value="generate" className="mt-4">
            <GenerateTab />
          </TabsContent>
        ) : null}
        {admin ? (
          <TabsContent value="recon" className="mt-4">
            <ReconciliationTab />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function AssessmentsTab({ canWaive }: { canWaive: boolean }) {
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [status, setStatus] = useState<LevyStatus | typeof ALL>(ALL);
  const [lga, setLga] = useState("");
  const [name, setName] = useState("");
  const debouncedName = useDebounced(name.trim());
  const [page, setPage] = useState(1);
  const [waiving, setWaiving] = useState<LevyAssessment | null>(null);
  const [paying, setPaying] = useState<LevyAssessment | null>(null);

  useEffect(() => {
    setPage(1);
  }, [year, status, lga, debouncedName]);

  const params = {
    page,
    per_page: PAGE_SIZE,
    ...(year !== ALL ? { year: Number(year) } : {}),
    ...(status !== ALL ? { status } : {}),
    ...(lga.trim() ? { lga: lga.trim() } : {}),
    ...(debouncedName ? { establishmentName: debouncedName } : {}),
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.levies.all(params),
    queryFn: () => leviesApi.all(params),
  });

  const meta = data?.meta;

  return (
    <>
      <SectionCard
        title="Levy assessments"
        description="Annual operating levies billed to approved establishments."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void exportsApi
                  .levies()
                  .then(saveBlobAs)
                  .catch(() => toast.error("Export failed"))
              }
            >
              Export CSV
            </Button>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="sm:w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All years</SelectItem>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as LevyStatus | typeof ALL)}>
              <SelectTrigger className="sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={lga} onValueChange={(v) => setLga(v === "all" ? "" : v)}>
              <SelectTrigger className="sm:w-36">
                <SelectValue placeholder="All LGAs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All LGAs</SelectItem>
                {OYO_LGAS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Establishment name"
              className="sm:w-48"
            />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Establishment</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Status</TableHead>
                    {canWaive ? <TableHead className="w-24" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {l.reference}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/admin/establishments/$id"
                          params={{ id: l.establishmentId }}
                          className="font-medium text-brand hover:underline"
                        >
                          {l.establishmentName}
                        </Link>
                      </TableCell>
                      <TableCell>{l.tierName || l.tierCode}</TableCell>
                      <TableCell>{l.year}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatNaira(l.amount)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(`${l.dueDate}T00:00:00`).toLocaleDateString("en-NG", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <LevyStatusBadge status={l.status} />
                      </TableCell>
                      {canWaive ? (
                        <TableCell>
                          {l.status === "Pending" || l.status === "Overdue" ? (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
                                onClick={() => setPaying(l)}
                              >
                                Mark paid
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setWaiving(l)}>
                                Waive
                              </Button>
                            </div>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            title="No assessments"
            hint="Generate annual assessments from the Generate tab."
          />
        )}
      </SectionCard>

      <WaiveLevyDialog levy={waiving} onClose={() => setWaiving(null)} />
      <MarkPaidDialog
        item={paying}
        label={paying ? `levy ${paying.reference}` : ""}
        onClose={() => setPaying(null)}
        onConfirm={(note, externalReference) =>
          leviesApi.markPaid(paying!.id, note, externalReference)
        }
      />
    </>
  );
}

export function MarkPaidDialog({
  item,
  label,
  onClose,
  onConfirm,
}: {
  item: { id: string } | null;
  label: string;
  onClose: () => void;
  onConfirm: (note?: string, externalReference?: string) => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [externalRef, setExternalRef] = useState("");

  useEffect(() => {
    if (item) {
      setNote("");
      setExternalRef("");
    }
  }, [item]);

  const mark = useMutation({
    mutationFn: () => onConfirm(note.trim() || undefined, externalRef.trim() || undefined),
    onSuccess: () => {
      toast.success(`Payment recorded — a second officer must confirm before it settles`);
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to record payment"),
  });

  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record manual payment</DialogTitle>
          <DialogDescription>
            Confirm {label} was paid outside the gateway (bank deposit, cash at the ministry).
            Two-person rule — the record goes to pending confirmations and a different officer must
            approve it before it settles.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mp-ref">Bank slip / receipt reference *</Label>
            <Input
              id="mp-ref"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="e.g. Teller no. 0012345"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-note">Note (optional)</Label>
            <Textarea
              id="mp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Cash received at ministry desk"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!externalRef.trim() || mark.isPending} onClick={() => mark.mutate()}>
            {mark.isPending ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WaiveLevyDialog({ levy, onClose }: { levy: LevyAssessment | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);

  if (levy && openFor !== levy.id) {
    setOpenFor(levy.id);
    setReason("");
  }

  const waive = useMutation({
    mutationFn: () => {
      if (!levy) return Promise.reject(new Error("No levy selected"));
      return leviesApi.waive(levy.id, reason.trim());
    },
    onSuccess: () => {
      toast.success("Levy waived");
      onClose();
      void qc.invalidateQueries({ queryKey: ["levies"] });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={levy !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Waive levy {levy?.reference}</DialogTitle>
          <DialogDescription>
            {levy ? `${levy.establishmentName} — ${formatNaira(levy.amount)} (${levy.year})` : ""}.
            A reason is required and recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="waive-reason">Reason</Label>
          <Textarea id="waive-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!reason.trim() || waive.isPending} onClick={() => waive.mutate()}>
            {waive.isPending ? "Waiving…" : "Waive levy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const generate = useMutation({
    mutationFn: () => leviesApi.generate(Number(year)),
    onSuccess: (r) => {
      toast.success(`Generated ${r.year}: ${r.created} issued, ${r.skipped} already existed`);
      void qc.invalidateQueries({ queryKey: ["levies"] });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const parsedYear = Number(year);
  const valid = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100;

  return (
    <SectionCard
      title="Generate annual assessments"
      description="Creates a levy assessment for every approved, tiered establishment for the selected year. Existing assessments are skipped."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="gen-year">Levy year</Label>
          <Input
            id="gen-year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="sm:w-32"
          />
        </div>
        <Button disabled={!valid || generate.isPending} onClick={() => generate.mutate()}>
          <Factory className="size-4" />
          {generate.isPending ? "Generating…" : "Generate levy assessments"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Owners are notified and a certificate is issued when payment clears.
      </p>
    </SectionCard>
  );
}

function ManualPaymentsTab() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const pending = useQuery({
    queryKey: ["payments", "pending-confirmation"],
    queryFn: paymentsApi.pendingConfirmations,
    refetchInterval: 30_000,
  });

  const confirm = useMutation({
    mutationFn: (id: string) => paymentsApi.confirmManual(id),
    onSuccess: () => {
      toast.success("Payment confirmed and settled");
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["levies"] });
      void qc.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Confirmation failed"),
  });

  const reject = useMutation({
    mutationFn: (id: string) => paymentsApi.rejectManual(id),
    onSuccess: () => {
      toast.success("Record rejected");
      void qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Reject failed"),
  });

  return (
    <SectionCard
      title="Manual payments awaiting confirmation"
      description="Two-person rule — a payment recorded by one officer must be confirmed by a different authorised officer before it settles."
    >
      {pending.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : pending.isError ? (
        <QueryError error={pending.error} onRetry={() => void pending.refetch()} />
      ) : pending.data?.length ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Establishment</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>External ref</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.data.map((t) => {
                const ownRecord = session?.id === t.recordedById;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                    <TableCell>{t.establishmentName ?? "—"}</TableCell>
                    <TableCell>{t.context}</TableCell>
                    <TableCell>{formatNaira(t.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.externalReference ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDateTime(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          disabled={confirm.isPending || ownRecord}
                          title={
                            ownRecord
                              ? "You recorded this — a second officer must confirm"
                              : undefined
                          }
                          onClick={() => confirm.mutate(t.id)}
                        >
                          {ownRecord ? "Awaiting 2nd officer" : "Confirm"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={reject.isPending || ownRecord}
                          title="Reject this record — releases the debt for a new record or gateway payment"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Reject this manual record? The debt returns to unpaid.",
                              )
                            )
                              reject.mutate(t.id);
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <RouteEmpty
          title="Nothing awaiting confirmation"
          hint="Manual payments recorded via Mark paid appear here until a second officer confirms them."
        />
      )}
    </SectionCard>
  );
}

interface DuplicatePayment {
  id: string;
  reference: string;
  amount: number;
  paidAt: string | null;
  context: string;
  debtReference: string;
  establishmentName: string;
  flagged: boolean;
  narration: string | null;
  senderName: string | null;
}

/** Duplicate settlements — money collected twice for one debt. The earliest
 * settlement stands; the rest are refund candidates. */
function ReconciliationTab() {
  const qc = useQueryClient();
  const dupes = useQuery({
    queryKey: ["admin", "payments", "duplicates"],
    queryFn: () => paymentsApi.duplicates() as Promise<DuplicatePayment[]>,
  });
  const [refunding, setRefunding] = useState<DuplicatePayment | null>(null);
  const [reason, setReason] = useState("");

  const refund = useMutation({
    mutationFn: () => paymentsApi.refund(refunding!.id, reason.trim()),
    onSuccess: () => {
      toast.success("Refund recorded");
      void qc.invalidateQueries({ queryKey: ["admin", "payments", "duplicates"] });
      void qc.invalidateQueries({ queryKey: ["levies"] });
      void qc.invalidateQueries({ queryKey: ["payments"] });
      setRefunding(null);
    },
    onError: (e: Error) => toast.error(e.message || "Refund failed"),
  });

  return (
    <>
      <SectionCard
        title="Duplicate settlements"
        description="Successful payments that arrived after the debt was already covered — refund candidates."
      >
        {dupes.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : dupes.isError ? (
          <QueryError error={dupes.error} onRetry={() => void dupes.refetch()} />
        ) : !dupes.data?.length ? (
          <RouteEmpty
            title="No duplicates"
            hint="Every successful settlement is the first for its debt."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Debt</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dupes.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.reference}</TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium">{d.debtReference}</span>
                      <span className="block text-muted-foreground">{d.context}</span>
                    </TableCell>
                    <TableCell className="text-sm">{d.establishmentName}</TableCell>
                    <TableCell>{formatNaira(d.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.paidAt ? fmtDateTime(d.paidAt) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{d.senderName ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReason("");
                          setRefunding(d);
                        }}
                      >
                        Refund
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Dialog open={refunding !== null} onOpenChange={(o) => !o && setRefunding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund {refunding?.reference}?</DialogTitle>
            <DialogDescription>
              Marks the transaction refunded. The earlier payment still covers the debt, so the
              levy/fine and certificate remain valid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Owner double-paid via bank transfer — refunding the duplicate."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefunding(null)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={refund.isPending || reason.trim().length < 5}
              onClick={() => refund.mutate()}
            >
              {refund.isPending ? "Refunding…" : "Record refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
