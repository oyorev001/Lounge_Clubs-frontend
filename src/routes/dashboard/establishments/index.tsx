import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { EstablishmentStatusBadge } from "@/components/common/status-badges";
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
import { establishmentsApi, queryKeys } from "@/services";

export const Route = createFileRoute("/dashboard/establishments/")({
  component: EstablishmentsPage,
});

function EstablishmentsPage() {
  const establishments = useQuery({
    queryKey: queryKeys.establishments.mine(),
    queryFn: establishmentsApi.mine,
  });

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="My establishments"
        description="Lounges, bars and clubs registered under your account"
        actions={
          <Button asChild size="sm">
            <Link to="/dashboard/establishments/register">
              <Plus className="size-4" /> Register new
            </Link>
          </Button>
        }
      >
        {establishments.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : establishments.isError ? (
          <QueryError error={establishments.error} onRetry={() => void establishments.refetch()} />
        ) : establishments.data?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Reg. number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>LGA</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {establishments.data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link
                        to="/dashboard/establishments/$id"
                        params={{ id: e.id }}
                        className="font-medium text-brand hover:underline"
                      >
                        {e.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.registrationNumber}</TableCell>
                    <TableCell>{e.type}</TableCell>
                    <TableCell>{e.lga}</TableCell>
                    <TableCell>{e.tierName ?? "—"}</TableCell>
                    <TableCell>
                      <EstablishmentStatusBadge status={e.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <RouteEmpty
            title="No establishments yet"
            hint="Register your first lounge, bar or club to begin the licensing process."
          />
        )}
      </SectionCard>
    </div>
  );
}
