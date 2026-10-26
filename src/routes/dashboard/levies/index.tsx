import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { PaymentDialog } from "@/components/common/payment-dialog";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { formatNaira, LevyStatusBadge } from "@/components/common/status-badges";
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
import { leviesApi, paymentsApi, queryKeys } from "@/services";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import type { LevyAssessment } from "@/services";

export const Route = createFileRoute("/dashboard/levies/")({
  component: LeviesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    focus: typeof s["focus"] === "string" ? s["focus"] : undefined,
  }),
});

function LeviesPage() {
  const levies = useQuery({ queryKey: queryKeys.levies.mine(), queryFn: leviesApi.mine });
  const [paying, setPaying] = useState<LevyAssessment | null>(null);
  const search = useSearch({ from: "/dashboard/levies/" });
  const navigate = useNavigate();
  const focus = search["focus"] ?? undefined;

  // Deep-link from notifications: ?focus={levyId} opens the pay dialog.
  useEffect(() => {
    if (!focus || !levies.data) return;
    const target = levies.data.find((l) => l.id === focus);
    if (target && (target.status === "Pending" || target.status === "Overdue")) {
      setPaying(target);
    }
  }, [focus, levies.data]);

  const sorted = levies.data ? [...levies.data].sort((a, b) => b.year - a.year) : [];

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Levy assessments"
        description="Annual license levies for your establishments"
      >
        {levies.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : levies.isError ? (
          <QueryError error={levies.error} onRetry={() => void levies.refetch()} />
        ) : sorted.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Establishment</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((l) => (
                  <TableRow
                    key={l.id}
                    className={focus === l.id ? "bg-amber-50 dark:bg-amber-950/20" : undefined}
                  >
                    <TableCell>
                      <p className="font-medium">{l.establishmentName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{l.reference}</p>
                    </TableCell>
                    <TableCell>{l.year}</TableCell>
                    <TableCell>{l.tierName}</TableCell>
                    <TableCell>{formatNaira(l.amount)}</TableCell>
                    <TableCell>{fmtDate(l.dueDate)}</TableCell>
                    <TableCell>
                      <LevyStatusBadge status={l.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {l.status === "Pending" || l.status === "Overdue" ? (
                        <Button size="sm" onClick={() => setPaying(l)}>
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
          <RouteEmpty
            title="No levies yet"
            hint="Levy assessments appear after your establishment is approved."
          />
        )}
      </SectionCard>

      <PaymentDialog
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        title={paying ? `Pay levy — ${paying.establishmentName} ${paying.year}` : "Pay levy"}
        description="Pay securely with Paystack — card, bank transfer or USSD."
        initiate={(key) => {
          if (!paying) return Promise.reject(new Error("No levy selected"));
          return paymentsApi.initiateLevy(paying.id, key);
        }}
      />
    </div>
  );
}
