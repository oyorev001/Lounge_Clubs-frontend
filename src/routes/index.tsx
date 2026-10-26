import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileBadge,
  Landmark,
  Martini,
  Megaphone,
  Music,
  Music4,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { formatNaira } from "@/components/common/status-badges";
import { SiteFooter, SiteHeader } from "@/components/layout/site-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/common/reveal";
import { QueryError } from "@/components/common/route-states";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys, tiersApi } from "@/services";

export const Route = createFileRoute("/")({ component: LandingPage });

const TIER_IMAGES: Record<string, string> = {
  BRONZE: "/images/tier-bronze.jpg",
  SILVER: "/images/type-nightclub.jpg",
  GOLD: "/images/tier-gold.jpg",
  PLATINUM: "/images/tier-platinum.jpg",
};

const VENUE_TYPES = [
  {
    name: "Lounges",
    image: "/images/type-lounge.jpg",
    icon: Martini,
    text: "Cocktail lounges and relaxed social spaces",
  },
  {
    name: "Bars",
    image: "/images/type-bar.jpg",
    icon: Landmark,
    text: "Drinking spots, pubs and neighbourhood bars",
  },
  {
    name: "Clubs",
    image: "/images/type-club.jpg",
    icon: Music,
    text: "Dance venues and live-entertainment clubs",
  },
  {
    name: "Nightclubs",
    image: "/images/type-nightclub.jpg",
    icon: Music4,
    text: "Late-night venues and event spaces",
  },
];

const STEPS = [
  {
    icon: Building2,
    title: "Register your venue",
    text: "Create an account, register your lounge, bar or club, and upload your CAC and identification documents.",
  },
  {
    icon: BadgeCheck,
    title: "Get classified",
    text: "A government officer reviews your application and assigns a compliance tier based on your venue's size and facilities.",
  },
  {
    icon: Receipt,
    title: "Pay the annual levy",
    text: "Pay securely with Paystack — card, bank transfer or USSD. Your payment is confirmed automatically.",
  },
  {
    icon: FileBadge,
    title: "Receive your certificate",
    text: "Get an official compliance certificate and payment receipt instantly — verifiable by QR code.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.2em] text-brand uppercase">
        <Sparkles className="size-3.5" /> {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      {hint ? <p className="mt-3 text-muted-foreground">{hint}</p> : null}
    </Reveal>
  );
}

function LandingPage() {
  const { session } = useAuth();
  const {
    data: tiers,
    isPending,
    isError,
    refetch,
    error,
  } = useQuery({
    queryKey: queryKeys.tiers.list(),
    queryFn: tiersApi.list,
  });
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero — full-width banner: photo, overlay, headline, CTAs */}
        <section className="relative isolate overflow-hidden border-b border-border">
          <img
            src="/images/hero.jpg"
            alt=""
            aria-hidden
            className="animate-ken-burns absolute inset-0 -z-10 h-full w-full object-cover object-[center_35%]"
          />
          {/* Left-to-right legibility scrim */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-[#160404]/95 via-[#160404]/75 to-[#160404]/35"
          />
          {/* Bottom fade — the photo blends into the page instead of being
              sliced mid-scene at the section edge. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-[#160404]/90 to-transparent"
          />
          <div className="mx-auto flex min-h-[420px] max-w-6xl items-center px-4 py-14 sm:min-h-[520px] sm:px-6 lg:min-h-[560px]">
            <div className="max-w-2xl">
              <div className="animate-fade-up flex items-center gap-3">
                <img
                  src="/images/oyo-crest.png"
                  alt="Oyo State coat of arms"
                  className="size-14 object-contain drop-shadow-md"
                />
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] text-white uppercase">
                    Oyo State Government
                  </p>
                  <p className="text-[11px] font-medium tracking-wide text-white/70">
                    Ministry of Culture and Tourism
                  </p>
                </div>
              </div>
              <h1 className="animate-fade-up delay-150 mt-6 text-balance font-display text-4xl font-bold text-white sm:text-5xl">
                Lounge &amp; Clubs Compliance, Standardization &amp; Regulation
              </h1>
              <p className="animate-fade-up delay-300 mt-5 max-w-xl text-lg text-white/80">
                The official portal for registering your establishment, paying your annual levy to
                the Oyo State Government, and receiving your verifiable compliance certificate.
              </p>
              <div className="animate-fade-up delay-450 mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/register">
                    Register your establishment <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <Link to="/verify">
                    <QrCode className="size-4" /> Verify a certificate
                  </Link>
                </Button>
              </div>
              <div className="animate-fade-up delay-500 mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70">
                <Link
                  to="/registry"
                  className="underline-offset-4 hover:text-white hover:underline"
                >
                  Public registry of licensed venues
                </Link>
                <span aria-hidden className="hidden text-white/30 sm:inline">
                  •
                </span>
                <Link to="/report" className="underline-offset-4 hover:text-white hover:underline">
                  Report a venue — no account needed
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip — claims that are always true, unlike raw counts
            which look thin in early rollout. */}
        <section className="border-b border-border bg-brand text-white">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-4 py-8 sm:grid-cols-4 sm:px-6">
            {[
              { icon: Landmark, label: "All 33 LGAs covered" },
              { icon: QrCode, label: "QR-verifiable certificates" },
              { icon: ShieldCheck, label: "Secure online payment" },
              { icon: FileBadge, label: "Instant certificate issue" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2 text-center">
                <s.icon className="size-6 text-white/85" />
                <p className="text-xs font-semibold tracking-wider text-white/90 uppercase sm:text-sm">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Who must register — venue-type photography strip */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="Who must register"
            title="Every entertainment venue in Oyo State"
            hint="If you operate any of these, the annual compliance levy applies to you."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VENUE_TYPES.map((v, i) => (
              <Reveal key={v.name} delay={i * 100}>
                <Link to="/register" className="group relative block overflow-hidden rounded-2xl">
                  <img
                    src={v.image}
                    alt={v.name}
                    loading="lazy"
                    className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <v.icon className="size-5 text-white/80" />
                    <h3 className="mt-1.5 font-display text-lg font-bold text-white">{v.name}</h3>
                    <p className="mt-0.5 text-xs text-white/70">{v.text}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <SectionHeading
              eyebrow="The process"
              title="Licensed in four steps"
              hint="From account to certificate — most owners finish in a single sitting."
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 100}>
                  <Card className="relative h-full overflow-visible transition duration-300 hover:-translate-y-1 hover:shadow-md">
                    <span className="absolute -top-3 left-5 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <CardContent className="pt-6">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <s.icon className="size-5" />
                      </span>
                      <h3 className="mt-3 font-semibold">{s.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Tiers */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <SectionHeading
              eyebrow="Annual levy"
              title="Fair pricing by venue size"
              hint="Your tier is assigned by a reviewing officer based on capacity, facilities and location."
            />
            {isError ? (
              <div className="mt-8">
                <QueryError error={error} onRetry={() => void refetch()} />
              </div>
            ) : null}
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {isPending &&
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
              {tiers?.map((t, i) => (
                <Reveal key={t.id} delay={i * 100}>
                  <Card className="flex h-full flex-col overflow-hidden border-t-4 border-t-brand pt-0 transition duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="relative h-36">
                      <img
                        src={TIER_IMAGES[t.code.toUpperCase()] ?? "/images/tier-silver.jpg"}
                        alt={t.name}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur">
                        {t.code}
                      </span>
                    </div>
                    <CardContent className="flex flex-1 flex-col pt-5">
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="mt-2 min-h-12 text-sm text-muted-foreground">{t.description}</p>
                      <div className="mt-auto pt-4"><p className="border-t border-dashed pt-3 font-display text-xl font-bold text-brand">
                        {formatNaira(t.annualFee)}
                        <span className="text-xs font-normal text-muted-foreground"> / year</span>
                      </p></div>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Enforcement band — full-bleed dark, not a card */}
        <section className="relative isolate overflow-hidden bg-[#1c0505] text-white">
          <img
            src="/images/oyo-crest.png"
            alt=""
            aria-hidden
            className="absolute -right-16 top-1/2 -z-10 w-96 -translate-y-1/2 opacity-[0.07]"
          />
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-14 sm:flex-row sm:items-center sm:px-6 sm:py-16">
            <ShieldCheck className="size-12 shrink-0 text-white/90" />
            <div className="flex-1">
              <h3 className="font-display text-2xl font-bold sm:text-3xl">
                Operating without a valid certificate is an offence
              </h3>
              <p className="mt-2 max-w-2xl text-white/75">
                Enforcement officers verify certificates in the field via QR code. Establishments
                without a valid certificate risk fines and closure. Keep yours current.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link to={session ? "/dashboard/levies" : "/login"}>Renew now</Link>
            </Button>
          </div>
        </section>

        {/* Public services */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="For residents"
            title="Open to every resident — no account needed"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: QrCode,
                title: "Verify a certificate",
                text: "Scan the QR on any certificate or enter its number to confirm it's genuine.",
                to: "/verify",
                cta: "Verify now",
              },
              {
                icon: Building2,
                title: "Licensed venues",
                text: "Browse the public registry of registered lounges, bars and clubs by LGA.",
                to: "/registry",
                cta: "Open the registry",
              },
              {
                icon: Megaphone,
                title: "Report a venue",
                text: "Noise, underage admission or an unlicensed operator? Report it for inspection.",
                to: "/report",
                cta: "File a report",
              },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <Card className="h-full transition duration-300 hover:-translate-y-1 hover:shadow-md">
                  <CardContent className="pt-6">
                    <s.icon className="size-8 text-brand" />
                    <h3 className="mt-3 font-semibold">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
                    <Button asChild variant="link" className="mt-2 h-auto p-0 text-brand">
                      <Link to={s.to}>{s.cta} →</Link>
                    </Button>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-border bg-gradient-to-b from-brand/[0.07] to-transparent">
          <Reveal className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-16">
            <h2 className="text-balance font-display text-3xl font-bold sm:text-4xl">
              Ready to get your venue licensed?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Registration takes minutes. Your certificate is issued the moment your levy clears.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/register">
                  Register your establishment <ArrowRight className="size-4" />
                </Link>
              </Button>
              {!session ? (
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">Sign in</Link>
                </Button>
              ) : null}
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
