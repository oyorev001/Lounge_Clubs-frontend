import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  MapPin,
  Megaphone,
  Search,
  Store,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useDebounced } from "@/hooks/use-debounced";
import { SiteFooter, SiteHeader } from "@/components/layout/site-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OYO_LGAS } from "@/lib/oyo";
import { cn } from "@/lib/utils";
import { complaintsApi, registryApi } from "@/services";
import type { RegistryVenue } from "@/services";

export const Route = createFileRoute("/_auth/report")({ component: ReportPage });

const CATEGORIES = [
  { value: "Noise", label: "Noise disturbance", hint: "Loud music, generators, late-night noise" },
  { value: "UnderageEntry", label: "Underage admission", hint: "Minors being let in or served" },
  {
    value: "UnlicensedOperation",
    label: "Unlicensed operation",
    hint: "Operating without a certificate",
  },
  { value: "Safety", label: "Safety concern", hint: "Fights, fire hazards, overcrowding" },
  { value: "Other", label: "Other", hint: "Anything else worth reporting" },
];

function ReportPage() {
  // Step 1: find the venue — LGA browse, name search, or free text fallback.
  const [lga, setLga] = useState("");
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState<RegistryVenue | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [venueDescription, setVenueDescription] = useState("");
  // Step 2: the report itself.
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);

  const debouncedQuery = useDebounced(query, 350);

  // Search beats LGA browse — typing a name searches statewide.
  const venues = useQuery({
    queryKey: ["report-venues", lga, debouncedQuery],
    queryFn: () =>
      registryApi.search({
        ...(debouncedQuery.trim().length >= 2 ? { q: debouncedQuery } : {}),
        ...(debouncedQuery.trim().length < 2 && lga ? { lga } : {}),
      }),
    enabled: lga !== "" || debouncedQuery.trim().length >= 2,
  });

  const submit = useMutation({
    mutationFn: complaintsApi.submit,
    onSuccess: () => setDone(true),
    onError: (err: Error) => toast.error(err.message || "Could not submit your report."),
  });

  const canSubmit =
    (venue !== null || venueDescription.trim().length >= 4) &&
    category !== "" &&
    details.trim().length >= 10;

  if (done) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
          <Card className="w-full max-w-md text-center">
            <CardContent className="space-y-4 pt-8 pb-8">
              <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
              <h1 className="font-display text-xl font-semibold">Report received</h1>
              <p className="text-sm text-muted-foreground">
                Thank you — your report about{" "}
                <b>{venue?.name ?? venueDescription}</b> has been sent to the compliance
                team at the Ministry of Culture and Tourism. An inspection may be scheduled.
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDone(false);
                    setVenue(null);
                    setCategory("");
                    setDetails("");
                    setVenueDescription("");
                  }}
                >
                  File another report
                </Button>
                <Button asChild>
                  <a href="/">Back to portal</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <div className="mb-8 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Megaphone className="size-6 text-primary" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              Report a lounge, bar or club
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Noise, underage admission, unlicensed operation — reports go straight to the
              compliance team. No account needed; your identity stays private.
            </p>
          </div>
        </div>

        {/* ── Step 1 — find the venue ─────────────────────────── */}
        <section>
          <p className="mb-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Step 1 — Which venue?
          </p>
          {venue ? (
            <div className="flex items-center justify-between rounded-lg border border-primary/50 bg-primary/[0.04] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{venue.name}</p>
                <p className="text-xs text-muted-foreground">
                  {venue.type}
                  {venue.additionalTypes.length ? ` + ${venue.additionalTypes.join(", ")}` : ""} ·{" "}
                  {venue.lga} · {venue.address}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setVenue(null);
                  setLga("");
                  setQuery("");
                }}
              >
                <ChevronLeft className="size-4" /> Change
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={lga}
                  onValueChange={(v) => {
                    setLga(v === "any" ? "" : v);
                    setQuery("");
                  }}
                >
                  <SelectTrigger className="sm:w-64">
                    <SelectValue placeholder="Pick your local government" />
                  </SelectTrigger>
                  <SelectContent>
                    {OYO_LGAS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="…or search by venue name statewide"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Venue list — browse by LGA or search */}
              {venues.isPending ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : venues.isError ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Couldn't load venues — try again or describe the venue below.
                </p>
              ) : venues.data && venues.data.length > 0 ? (
                <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {venues.data.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setVenue(v);
                        setFallbackMode(false);
                      }}
                      className={cn(
                        "rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/60 hover:shadow-sm",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{v.name}</p>
                        {v.isLicensed ? (
                          <Badge className="shrink-0 bg-emerald-100 text-[10px] text-emerald-800 hover:bg-emerald-100">
                            <BadgeCheck className="size-3" /> Licensed
                          </Badge>
                        ) : v.status === "Suspended" ? (
                          <Badge className="shrink-0 bg-rose-100 text-[10px] text-rose-800 hover:bg-rose-100">
                            <AlertTriangle className="size-3" /> Suspended
                          </Badge>
                        ) : (
                          <Badge className="shrink-0 bg-amber-100 text-[10px] text-amber-800 hover:bg-amber-100">
                            <AlertTriangle className="size-3" /> Unlicensed
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {v.type}
                        {v.additionalTypes.length ? ` + ${v.additionalTypes.join(", ")}` : ""}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="size-3" /> {v.lga} · {v.address}
                      </p>
                    </button>
                  ))}
                </div>
              ) : lga || debouncedQuery.trim().length >= 2 ? (
                <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  <Store className="mx-auto mb-2 size-6 text-muted-foreground/50" />
                  No licensed venues found{debouncedQuery ? ` for “${debouncedQuery}”` : lga ? ` in ${lga}` : ""}.
                  Venue not registered? Describe it below — that matters to us too.
                </p>
              ) : null}

              {/* Venue not listed — free text fallback */}
              {!fallbackMode ? (
                <button
                  type="button"
                  onClick={() => setFallbackMode(true)}
                  className="mt-3 text-sm font-medium text-brand hover:underline"
                >
                  Can't find the venue? Describe it instead
                </button>
              ) : (
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="venue-desc">Describe the venue</Label>
                  <Input
                    id="venue-desc"
                    value={venueDescription}
                    onChange={(e) => setVenueDescription(e.target.value)}
                    placeholder="e.g. Bar near Challenge roundabout, painted blue — 'Star De-Lounge'"
                  />
                  <p className="text-xs text-muted-foreground">
                    Landmarks help officers find it — street, bus stop, neighbouring shop.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Step 2 — what happened ──────────────────────────── */}
        <section className={cn("mt-8", !venue && !fallbackMode && "opacity-60")}>
          <p className="mb-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Step 2 — What happened?
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  category === c.value
                    ? "border-primary bg-primary/[0.05] ring-1 ring-primary/40"
                    : "border-border hover:border-primary/50",
                )}
              >
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</p>
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="details">Tell us more</Label>
            <Textarea
              id="details"
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What happened, when, and how often — e.g. 'Loud music until 4am every Friday, started around 3 months ago'"
            />
            <p className="text-xs text-muted-foreground">
              At least 10 characters — the more specific, the faster officers can act.
            </p>
          </div>
        </section>

        {/* ── Step 3 — optional contact ───────────────────────── */}
        <section className="mt-8">
          <p className="mb-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Step 3 — Your details <span className="font-normal normal-case">(optional)</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-name">Name</Label>
              <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-phone">Phone</Label>
              <Input
                id="r-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="For follow-up questions only"
              />
            </div>
          </div>
        </section>

        <div className="mt-8">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            disabled={!canSubmit || submit.isPending}
            onClick={() =>
              submit.mutate({
                ...(venue ? { establishmentId: venue.id } : {}),
                ...(venueDescription.trim() && !venue
                  ? { venueDescription: venueDescription.trim() }
                  : {}),
                category,
                details: details.trim(),
                ...(name.trim() ? { complainantName: name.trim() } : {}),
                ...(phone.trim() ? { complainantPhone: phone.trim() } : {}),
              })
            }
          >
            {submit.isPending ? "Submitting…" : "Submit report"}
          </Button>
          {!canSubmit ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Pick a venue (or describe it), choose a category, and write a few words about what
              happened.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Reports go to the compliance team — your identity is never shared with the venue.
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
