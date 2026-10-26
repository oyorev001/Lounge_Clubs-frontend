import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PaginationControls } from "@/components/common/pagination";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { FineStatusBadge, formatNaira } from "@/components/common/status-badges";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { MarkPaidDialog } from "@/routes/admin/levies";
import { canFinance, finesApi, queryKeys } from "@/services";
import type { Fine, FineStatus } from "@/services";

export const Route = createFileRoute("/admin/fines")({ component: FinesPage });

const ALL = "all";
const PAGE_SIZE = 15;
const STATUS_OPTIONS: FineStatus[] = ["Unpaid", "Paid", "Waived"];

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

function FinesPage() {
  const { session } = useAuth();
  const canWaive = canFinance(session?.role);
  const [status, setStatus] = useState<FineStatus | typeof ALL>(ALL);
  const [page, setPage] = useState(1);
  const [waiving, setWaiving] = useState<Fine | null>(null);
  const [paying, setPaying] = useState<Fine | null>(null);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const params = {
    page,
    per_page: PAGE_SIZE,
    ...(status !== ALL ? { status } : {}),
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.fines.list(params),
    queryFn: () => finesApi.list(params),
  });

  const meta = data?.meta;

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Fines"
        description="Penalties issued for non-compliance. Fines must be settled before certificate renewal."
        actions={
          <Select value={status} onValueChange={(v) => setStatus(v as FineStatus | typeof ALL)}>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued by</TableHead>
                    {canWaive ? <TableHead className="w-24" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {f.reference}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/admin/establishments/$id"
                          params={{ id: f.establishmentId }}
                          className="font-medium text-brand hover:underline"
                        >
                          {f.establishmentName}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {f.fineType.replace(/([a-z])([A-Z])/g, "$1 $2")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatNaira(f.amount)}</TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">
                        {f.reason}
                      </TableCell>
                      <TableCell>
                        <FineStatusBadge status={f.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {f.issuedByName ?? "—"}
                      </TableCell>
                      {canWaive ? (
                        <TableCell>
                          {f.status === "Unpaid" ? (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
                                onClick={() => setPaying(f)}
                              >
                                Mark paid
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setWaiving(f)}>
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
            title="No fines"
            hint="Fines are issued from an establishment's review page."
          />
        )}
      </SectionCard>

      <WaiveFineDialog fine={waiving} onClose={() => setWaiving(null)} />
      <MarkPaidDialog
        item={paying}
        label={paying ? `fine ${paying.reference}` : ""}
        onClose={() => setPaying(null)}
        onConfirm={(note, externalReference) =>
          finesApi.markPaid(paying!.id, note, externalReference)
        }
      />
    </div>
  );
}

function WaiveFineDialog({ fine, onClose }: { fine: Fine | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);

  if (fine && openFor !== fine.id) {
    setOpenFor(fine.id);
    setReason("");
  }

  const waive = useMutation({
    mutationFn: () => {
      if (!fine) return Promise.reject(new Error("No fine selected"));
      return finesApi.waive(fine.id, reason.trim());
    },
    onSuccess: () => {
      toast.success("Fine waived");
      onClose();
      void qc.invalidateQueries({ queryKey: ["fines"] });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={fine !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Waive fine {fine?.reference}</DialogTitle>
          <DialogDescription>
            {fine ? `${fine.establishmentName} — ${formatNaira(fine.amount)}` : ""}. A reason is
            required and recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="fine-waive-reason">Reason</Label>
          <Textarea
            id="fine-waive-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!reason.trim() || waive.isPending} onClick={() => waive.mutate()}>
            {waive.isPending ? "Waiving…" : "Waive fine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
