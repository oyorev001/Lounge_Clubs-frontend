import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { isStaff, roleHome } from "@/services";

export function BrandMark() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5">
      <img src="/images/oyo-crest.png" alt="Oyo State crest" className="size-10 object-contain" />
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold tracking-wide">OYO STATE</span>
        <span className="block text-[11px] font-medium text-muted-foreground">
          Lounge &amp; Clubs Portal
        </span>
      </span>
    </Link>
  );
}

const NAV = [
  { to: "/", label: "Home" },
  { to: "/registry", label: "Licensed venues" },
  { to: "/verify", label: "Verify Certificate" },
  { to: "/report", label: "Report a venue" },
] as const;

export function SiteHeader() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);

  const links = (
    <>
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => setOpen(false)}
          activeOptions={{ exact: item.to === "/" }}
          className="relative px-1 py-2 text-sm font-medium text-foreground/60 transition-colors after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-brand after:transition-transform after:duration-200 hover:text-foreground hover:after:scale-x-100 data-[status=active]:text-foreground data-[status=active]:after:scale-x-100"
        >
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <BrandMark />
        <nav className="ml-auto hidden items-center gap-6 md:flex">{links}</nav>
        <div className="ml-6 flex items-center gap-2 max-md:ml-auto">
          {session ? (
            <Button asChild size="sm">
              <Link to={roleHome(session.role)}>
                {isStaff(session.role) ? "Staff portal" : "My dashboard"}
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="mt-8 flex flex-col gap-1">{links}</nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src="/images/oyo-crest.png"
                alt="Oyo State crest"
                className="size-8 object-contain"
              />
              <p className="text-sm font-semibold">
                Oyo State Lounge &amp; Clubs Compliance Portal
              </p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Ministry of Culture and Tourism · Oyo State Tourism Board — compliance,
              standardization and regulation of lounges, bars, clubs and nightclubs in Oyo State.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold tracking-wider text-foreground/70 uppercase">
              Public services
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/registry" className="text-muted-foreground hover:text-foreground">
                  Licensed venues registry
                </Link>
              </li>
              <li>
                <Link to="/verify" className="text-muted-foreground hover:text-foreground">
                  Verify a certificate
                </Link>
              </li>
              <li>
                <Link to="/report" className="text-muted-foreground hover:text-foreground">
                  Report an unregistered venue
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-muted-foreground hover:text-foreground">
                  Register your establishment
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold tracking-wider text-foreground/70 uppercase">
              Contact the ministry
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Ministry of Culture and Tourism
              <br />
              State Secretariat, Agodi
              <br />
              Ibadan, Oyo State
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Certificate verification issues: use the{" "}
              <Link to="/report" className="underline hover:text-foreground">
                report form
              </Link>
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-[11px] text-muted-foreground">
            An official Oyo State Government portal.
          </p>
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Oyo State Government. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
