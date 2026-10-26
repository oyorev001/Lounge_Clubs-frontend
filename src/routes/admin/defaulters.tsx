import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { PaginationControls } from "@/components/common/pagination";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { Pill } from "@/components/common/status-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi, exportsApi, queryKeys, saveBlobAs } from "@/services";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/defaulters")({ component: DefaultersPage });

const PAGE_SIZE = 15;

function DefaultersPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.defaulters({ page, per_page: PAGE_SIZE }),
    queryFn: () => adminApi.defaulters({ page, per_page: PAGE_SIZE }),
  });

  const meta = data?.meta;

  return (
    <div className="px-4 py-6 sm:px-8">
      <Card className="border-warning/50 bg-warning/5">
        <CardContent className="flex items-start gap-3 pt-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-semibold">Defaulters</p>
            <p className="text-sm text-muted-foreground">
              Establishments with overdue levies or expired certificates. Prioritise enforcement
              visits by days overdue.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void exportsApi
                .defaulters()
                .then(saveBlobAs)
                .catch(() => toast.error("Export failed"))
            }
          >
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6">
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : isError ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data && data.data.length > 0 ? (
          <div className="shadow-card rounded-lg border border-border bg-card p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reg. number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>LGA</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Overdue levies</TableHead>
                    <TableHead>Days overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {d.registrationNumber}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/admin/establishments/$id"
                          params={{ id: d.id }}
                          className="font-medium text-brand hover:underline"
                        >
                          {d.name}
                        </Link>
                      </TableCell>
                      <TableCell>{d.type}</TableCell>
                      <TableCell className="whitespace-nowrap">{d.lga}</TableCell>
                      <TableCell>{d.tierCode ?? "—"}</TableCell>
                      <TableCell>
                        <p className="text-sm">{d.ownerName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[d.ownerPhone, d.ownerEmail].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Pill tone="danger">{d.overdueLeviesCount}</Pill>
                      </TableCell>
                      <TableCell>
                        {d.daysSinceExpiryOrDue != null ? (
                          <span
                            className={
                              d.daysSinceExpiryOrDue > 90
                                ? "font-semibold text-destructive"
                                : "font-semibold text-warning"
                            }
                          >
                            {d.daysSinceExpiryOrDue}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
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
          </div>
        ) : (
          <RouteEmpty
            title="No defaulters"
            hint="Every licensed establishment is currently in good standing."
          />
        )}
      </div>
    </div>
  );
}
