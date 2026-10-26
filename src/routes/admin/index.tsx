import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { formatNaira } from "@/components/common/status-badges";
import { StatCard } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QueryError } from "@/components/common/route-states";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, queryKeys } from "@/services";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: adminApi.dashboard,
  });

  const collectionRate =
    data && data.levies.expectedRevenue > 0
      ? Math.round((data.levies.collectedRevenue / data.levies.expectedRevenue) * 100)
      : 0;

  if (isError) {
    return (
      <div className="space-y-6 px-4 py-6 sm:px-8">
        <QueryError error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Establishments" value={String(data?.establishments.total ?? 0)} />
        <StatCard
          label="Pending review"
          value={String(data?.establishments.pendingReview ?? 0)}
          tone={data && data.establishments.pendingReview > 0 ? "warning" : "default"}
        />
        <StatCard
          label={`Levy collected ${data?.levies.currentYear ?? new Date().getFullYear()}`}
          value={formatNaira(data?.levies.collectedRevenue ?? 0)}
          tone="success"
        />
        <StatCard
          label="Non-compliant"
          value={String(data?.establishments.nonCompliant ?? 0)}
          tone={data && data.establishments.nonCompliant > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Levy collection — {data?.levies.currentYear ?? new Date().getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-28 w-full" />
            ) : data ? (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-display text-3xl font-bold">{collectionRate}%</p>
                    <p className="text-sm text-muted-foreground">
                      {formatNaira(data.levies.collectedRevenue)} of{" "}
                      {formatNaira(data.levies.expectedRevenue)} expected
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      {data.levies.paid} paid ·{" "}
                      {data.levies.issued -
                        data.levies.paid -
                        data.levies.overdue -
                        data.levies.waived}{" "}
                      pending · {data.levies.overdue} overdue
                    </p>
                    <p className="text-muted-foreground">{data.levies.issued} assessments issued</p>
                  </div>
                </div>
                <Progress value={collectionRate} className="mt-4" />
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : data ? (
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Active</span>
                  <b>{data.certificates.active}</b>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Expired</span>
                  <b>{data.certificates.expired}</b>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Revoked</span>
                  <b>{data.certificates.revoked}</b>
                </li>
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fines</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : data ? (
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Unpaid</span>
                  <b>{data.fines.unpaid}</b>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Outstanding</span>
                  <b>{formatNaira(data.fines.outstandingAmount)}</b>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Collected</span>
                  <b>{formatNaira(data.fines.collectedAmount)}</b>
                </li>
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspections</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : data ? (
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Scheduled upcoming</span>
                  <b>{data.inspections.scheduledUpcoming}</b>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Awaiting report</span>
                  <b className={data.inspections.awaitingReport > 0 ? "text-warning" : undefined}>
                    {data.inspections.awaitingReport}
                  </b>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Completed this month</span>
                  <b>{data.inspections.completedThisMonth}</b>
                </li>
                <li className="flex justify-between border-t border-dashed pt-2">
                  <span className="text-muted-foreground">Open complaints</span>
                  <b className={data.openComplaints > 0 ? "text-warning" : undefined}>
                    {data.openComplaints}
                  </b>
                </li>
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Establishments by tier (licensed)</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : data?.tiers.length ? (
              <ul className="space-y-2">
                {data.tiers.map((t) => (
                  <li key={t.code} className="flex items-center justify-between text-sm">
                    <span>{t.name}</span>
                    <b>{t.count}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No tiered establishments yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link to="/admin/establishments">Review applications</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link to="/admin/defaulters">View defaulters</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link to="/admin/levies">Levy assessments</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link to="/admin/inspections">Inspections</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="justify-start">
              <Link to="/admin/complaints">Complaints</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
