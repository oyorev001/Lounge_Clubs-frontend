import { Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, QrCode, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { BrandMark } from "./site-chrome";

/**
 * Shared shell for every authentication screen — a pinned brand panel on the
 * left (desktop only) with the venue photo + trust points, the form card on
 * the right. Keeps login/register/verify/forgot/reset visually identical
 * instead of five hand-rolled centered-card pages.
 */
export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Brand panel — pinned to the viewport, photo actually visible */}
      <aside className="relative hidden overflow-hidden bg-[#1c0505] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:p-10">
        <img
          src="/images/hero.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[center_40%] opacity-75"
        />
        {/* Scrim only where text lives — dark on the left where content sits,
            transparent on the right so the photo carries the panel. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[#160404]/85 via-[#160404]/40 to-[#160404]/10"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#160404]/60 to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#160404]/90 to-transparent"
        />

        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <img
              src="/images/oyo-crest.png"
              alt="Oyo State crest"
              className="size-11 object-contain drop-shadow"
            />
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold tracking-wide text-white">
                OYO STATE
              </span>
              <span className="block text-[11px] font-medium text-white/75">
                Ministry of Culture and Tourism
              </span>
            </span>
          </Link>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-balance font-display text-3xl font-bold text-white drop-shadow-md">
            The official portal for venue compliance in Oyo State
          </h2>
          <ul className="mt-5 space-y-2.5 text-sm text-white/90">
            {[
              { icon: BadgeCheck, text: "Register your lounge, bar or club in minutes" },
              { icon: ShieldCheck, text: "Pay the annual levy securely online" },
              { icon: QrCode, text: "Get a QR-verifiable compliance certificate" },
            ].map((i) => (
              <li key={i.text} className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <i.icon className="size-4" />
                </span>
                {i.text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form pane */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-background px-4 py-8">
        <img
          src="/images/oyo-crest.png"
          alt=""
          aria-hidden
          className="absolute -bottom-16 -right-16 -z-0 w-64 opacity-[0.05]"
        />
        <div className="relative mb-6 lg:hidden">
          <BrandMark />
        </div>
        <div
          className={`animate-fade-up relative w-full ${wide ? "max-w-2xl" : "max-w-md lg:max-w-lg"}`}
        >
          {children}
        </div>
        <Link
          to="/"
          className="relative mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to portal
        </Link>
      </div>
    </div>
  );
}
