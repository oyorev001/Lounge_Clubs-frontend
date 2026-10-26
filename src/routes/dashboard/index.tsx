import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  MapPin,
  Plus,
  RefreshCcw,
  Receipt,
  ShieldCheck,
} from "lucide-react";

import {
  CertificateStatusBadge,
  EstablishmentStatusBadge,
  formatNaira,
  LevyStatusBadge,
} from "@/components/common/status-badges";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { certificatesApi, establishmentsApi, finesApi, leviesApi, queryKeys } from "@/services";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard/")({ component: OwnerOverview });

const TYPE_IMAGES: Record<string, string> = {
  Bar: "/images/type-bar.jpg",
  Lounge: "/images/type-lounge.jpg",
  Club: "/images/type-club.jpg",
  Nightclub: "/images/type-nightclub.jpg",
};

function OwnerOverview() {
  const { session } = useAuth();
  const establishments = useQuery({
    queryKey: queryKeys.establishments.mine(),
    queryFn: establishmentsApi.mine,
  });
  const levies = useQuery({ queryKey: queryKeys.levies.mine(), queryFn: leviesApi.mine });
  const certs = useQuery({
    queryKey: queryKeys.certificates.mine(),
    queryFn: certificatesApi.mine,
  });
  const fines = useQuery({ queryKey: queryKeys.fines.mine(), queryFn: finesApi.mine });

  const unpaidLevies =
    levies.data?.filter((l) => l.status === "Pending" || l.status === "Overdue") ?? [];
  const unpaidFines = fines.data?.filter((f) => f.status === "Unpaid") ?? [];
  const outstanding =
    unpaidLevies.reduce((s, l) => s + l.amount, 0) + unpaidFines.reduce((s, f) => s + f.amount, 0);
  const activeCerts = certs.data?.filter((c) => c.isValid) ?? [];

  const in60d = Date.now() + 60 * 86400_000;
  const expiringSoon = activeCerts.filter(
    (c) => c.expiryDate && new Date(c.expiryDate).getTime() < in60d,
  );

  const checklist = [
    { label: "Establishment registered", ok: (establishments.data?.length ?? 0) > 0 },
    {
      label: "Approved & licensed",
      ok: (establishments.data ?? []).some((e) => e.status === "Approved"),
    },
    { label: "Active certificate", ok: activeCerts.length > 0 },
    { label: "No overdue levies", ok: !levies.data?.some((l) => l.status === "Overdue") },
    { label: "No unpaid fines", ok: unpaidFines.length === 0 },
  ];
  const issues = checklist.filter((c) => !c.ok).length;
  const firstName = session?.name?.split(" ")[0] ?? "there";

  return (
    <div className="px-4 py-6 sm:px-8">
      {/* Hero — status at a glance */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-[#8a1a1a] to-[#4a0505] text-white shadow-lg">
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -left-8 size-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/70">Welcome back,</p>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{firstName}</h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/80">
                {issues === 0 ? (
                  <>
                    <ShieldCheck className="size-4 text-emerald-300" />
                    Fully compliant — nothing needs your attention
                  </>
                ) : (
                  <>
                    <CircleAlert className="size-4 text-amber-300" />
                    {issues} {issues === 1 ? "item needs" : "items need"} your attention
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-3xl font-bold">{establishments.data?.length ?? 0}</p>
                <p className="text-xs text-white/70">Venues</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{activeCerts.length}</p>
                <p className="text-xs text-white/70">Active certs</p>
              </div>
              <div>
                <p className={`text-3xl font-bold ${outstanding > 0 ? "text-amber-300" : ""}`}>
                  {outstanding > 0 ? formatNaira(outstanding) : "₦0"}
                </p>
                <p className="text-xs text-white/70">Outstanding</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="bg-white text-brand hover:bg-white/90">
              <Link to="/dashboard/establishments/register">
                <Plus className="size-4" /> Register a venue
              </Link>
            </Button>
            {unpaidLevies.length + unpaidFines.length > 0 ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link to="/dashboard/levies">
                  <Receipt className="size-4" /> Pay {unpaidLevies.length + unpaidFines.length} item
                  {unpaidLevies.length + unpaidFines.length === 1 ? "" : "s"}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Compliance checklist strip */}
      <Card className="mt-5">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3.5">
          <span className="text-sm font-medium text-muted-foreground">Compliance:</span>
          {checklist.map((c) => (
            <span key={c.label} className="flex items-center gap-1.5 text-sm">
              {c.ok ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <CircleAlert className="size-4 text-amber-500" />
              )}
              <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
            </span>
          ))}
        </CardContent>
      </Card>

      {/* Action alerts */}
      {expiringSoon.length > 0 || unpaidLevies.length > 0 || unpaidFines.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {expiringSoon.length > 0 ? (
            <Card className="border-amber-300 bg-amber-50/60">
              <CardContent className="flex items-start gap-3 pt-5">
                <RefreshCcw className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">Certificate renewal due</p>
                  <p className="text-sm text-muted-foreground">
                    {expiringSoon
                      .map((c) => `${c.establishmentName} — expires ${c.expiryDate}`)
                      .join(" · ")}
                    . Pay the renewal levy to keep your certificate valid.
                  </p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to="/dashboard/levies">
                      Renew now <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {unpaidLevies.length > 0 || unpaidFines.length > 0 ? (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="flex items-start gap-3 pt-5">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning" />
                <div>
                  <p className="font-semibold">{formatNaira(outstanding)} outstanding</p>
                  <p className="text-sm text-muted-foreground">
                    {unpaidLevies.length} unpaid {unpaidLevies.length === 1 ? "levy" : "levies"}
                    {unpaidFines.length > 0
                      ? ` and ${unpaidFines.length} unpaid ${unpaidFines.length === 1 ? "fine" : "fines"}`
                      : ""}
                    . Pay now to keep your certificate valid.
                  </p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to="/dashboard/levies">
                      View levies <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Establishments — visual cards */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My establishments</h2>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/establishments/register">
              <Plus className="size-4" /> Register
            </Link>
          </Button>
        </div>
        {establishments.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : establishments.isError ? (
          <QueryError error={establishments.error} onRetry={() => void establishments.refetch()} />
        ) : establishments.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {establishments.data.map((e) => (
              <Link
                key={e.id}
                to="/dashboard/establishments/$id"
                params={{ id: e.id }}
                className="group overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative h-28 overflow-hidden">
                  <img
                    src={TYPE_IMAGES[e.type] ?? "/images/type-lounge.jpg"}
                    alt={e.type}
                    className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-2 left-3 text-xs font-medium text-white/90">
                    {e.type}
                    {e.additionalTypes?.length ? ` + ${e.additionalTypes.join(", ")}` : ""}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      {e.registrationNumber} · {e.lga}
                    </p>
                  </div>
                  <EstablishmentStatusBadge status={e.status} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <RouteEmpty
            title="No establishments yet"
            hint="Register your first lounge, bar or club to begin."
          />
        )}
      </div>

      {/* Levies + certificates */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Levy assessments</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/dashboard/levies">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {levies.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : levies.isError ? (
              <QueryError error={levies.error} onRetry={() => void levies.refetch()} />
            ) : levies.data?.length ? (
              <ul className="divide-y divide-border">
                {levies.data.slice(0, 5).map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {l.establishmentName} — {l.year}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNaira(l.amount)} · due {fmtDate(l.dueDate)}
                      </p>
                    </div>
                    <LevyStatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <RouteEmpty
                title="No levies yet"
                hint="Levy assessments appear after your establishment is approved."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Certificates</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/dashboard/certificates">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {certs.isPending ? (
              <Skeleton className="h-20 w-full" />
            ) : certs.isError ? (
              <QueryError error={certs.error} onRetry={() => void certs.refetch()} />
            ) : certs.data?.length ? (
              <ul className="divide-y divide-border">
                {certs.data.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                        <BadgeCheck className="size-5 text-emerald-600" />
                      </span>
                      <div>
                        <p className="font-mono text-sm font-medium">{c.certificateNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.establishmentName} · expires {fmtDate(c.expiryDate)}
                        </p>
                      </div>
                    </div>
                    <CertificateStatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <RouteEmpty
                title="No certificates"
                hint="Certificates are issued automatically when a levy payment is confirmed."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
