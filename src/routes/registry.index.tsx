import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, MapPin, Search, ShieldX } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/common/route-states";
import { Skeleton } from "@/components/ui/skeleton";
import { OYO_LGAS } from "@/lib/oyo";
import { registryApi } from "@/services";

export const Route = createFileRoute("/registry/")({ component: RegistryPage });

function RegistryPage() {
  const [q, setQ] = useState("");
  const [lga, setLga] = useState("");
  const [submitted, setSubmitted] = useState({ q: "", lga: "" });

  const venues = useQuery({
    queryKey: ["registry", submitted.q, submitted.lga],
    queryFn: () => registryApi.search(submitted),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Venue registry</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Public register of lounges, bars, clubs and nightclubs licensed by the Oyo State
          Government. Verify a venue holds a valid operating certificate before patronising — or{" "}
          <Link to="/report" className="text-primary underline">
            report an unlicensed venue
          </Link>
          .
        </p>
      </div>

      <form
        className="mb-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted({ q: q.trim(), lga });
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by venue name or CAC number…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={lga}
          onChange={(e) => setLga(e.target.value)}
        >
          <option value="">All LGAs</option>
          {OYO_LGAS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <Button type="submit">Search</Button>
      </form>

      {venues.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : venues.isError ? (
        <QueryError error={venues.error} onRetry={() => void venues.refetch()} />
      ) : venues.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {venues.data.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex items-start justify-between gap-3 pt-5 pb-5">
                <div>
                  <p className="font-semibold">{v.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {v.type}
                    {v.additionalTypes?.length ? ` + ${v.additionalTypes.join(", ")}` : ""}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" /> {v.address}, {v.lga}
                  </p>
                </div>
                {v.isLicensed ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <BadgeCheck className="size-3.5" /> Licensed
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                    <ShieldX className="size-3.5" /> Not licensed
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">No matching licensed venues</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different name or LGA. If a venue is missing it may be unlicensed — you can{" "}
              <Link to="/report" className="text-primary underline">
                report it
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
