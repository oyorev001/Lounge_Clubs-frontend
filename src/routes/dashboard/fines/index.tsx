import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { PaymentDialog } from "@/components/common/payment-dialog";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { FineStatusBadge, formatNaira } from "@/components/common/status-badges";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { finesApi, paymentsApi, queryKeys } from "@/services";
import type { Fine } from "@/services";

export const Route = createFileRoute("/dashboard/fines/")({
  component: FinesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    focus: typeof s["focus"] === "string" ? s["focus"] : undefined,
  }),
});

function FinesPage() {
  const fines = useQuery({ queryKey: queryKeys.fines.mine(), queryFn: finesApi.mine });
  const [paying, setPaying] = useState<Fine | null>(null);
  const search = useSearch({ from: "/dashboard/fines/" });
  const navigate = useNavigate();
  const focus = search["focus"] ?? undefined;

  useEffect(() => {
    if (!focus || !fines.data) return;
    const target = fines.data.find((f) => f.id === focus);
    if (target && target.status === "Unpaid") {
      setPaying(target);
    }
  }, [focus, fines.data]);

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Fines"
        description="Fines issued to your establishments for compliance violations"
      >
        {fines.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : fines.isError ? (
          <QueryError error={fines.error} onRetry={() => void fines.refetch()} />
        ) : fines.data?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Establishment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fines.data.map((f) => (
                  <TableRow
                    key={f.id}
                    className={focus === f.id ? "bg-amber-50 dark:bg-amber-950/20" : undefined}
                  >
                    <TableCell className="font-mono text-xs">{f.reference}</TableCell>
                    <TableCell>{f.establishmentName}</TableCell>
                    <TableCell>{f.fineType}</TableCell>
                    <TableCell className="max-w-64">
                      <p className="truncate text-sm text-muted-foreground" title={f.reason}>
                        {f.reason}
                      </p>
                    </TableCell>
                    <TableCell>{formatNaira(f.amount)}</TableCell>
                    <TableCell>
                      <FineStatusBadge status={f.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {f.status === "Unpaid" ? (
                        <Button size="sm" onClick={() => setPaying(f)}>
                          Pay
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <RouteEmpty title="No fines" hint="You have no fines on record. Keep it up!" />
        )}
      </SectionCard>

      <PaymentDialog
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        title={paying ? `Pay fine — ${paying.fineType}` : "Pay fine"}
        description="Pay securely with Paystack — card, bank transfer or USSD."
        initiate={(key) => {
          if (!paying) return Promise.reject(new Error("No fine selected"));
          return paymentsApi.initiateFine(paying.id, key);
        }}
      />
    </div>
  );
}
