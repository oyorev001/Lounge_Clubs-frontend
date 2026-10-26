import { Link, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, LogOut, Menu } from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/layout/site-chrome";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export interface DashboardNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface DashboardShellProps {
  role: string;
  identity: string;
  nav: DashboardNavItem[];
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Full-width strip between the header bar and the padded <main> — for alerts. */
  banner?: React.ReactNode;
  children: React.ReactNode;
}

function DashboardSignOut({ className }: { className?: string }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={logout.isPending}
      className={cn(
        "justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground",
        className,
      )}
      onClick={() => {
        logout.mutate(undefined, {
          onSuccess: () => {
            toast.success("Signed out");
            void navigate({ to: "/" });
          },
        });
      }}
    >
      <LogOut className="h-4 w-4" /> Sign out
    </Button>
  );
}

export function DashboardShell({
  role,
  identity,
  nav,
  title,
  subtitle,
  actions,
  banner,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground lg:fixed lg:top-0 lg:left-0 lg:flex lg:h-screen">
        <div className="[&_span]:text-sidebar-foreground">
          <BrandMark />
        </div>
        <div className="mt-6 rounded-md bg-sidebar-accent px-3 py-2.5">
          <p className="text-[11px] tracking-wide text-sidebar-foreground/60 uppercase">{role}</p>
          <p className="mt-0.5 text-sm font-medium">{identity}</p>
        </div>
        <nav className="mt-5 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-col border-t border-sidebar-border pt-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to portal
          </Link>
          <DashboardSignOut />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <div className="border-b border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 lg:hidden"
                    aria-label="Open menu"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72">
                  <div className="mt-8">
                    <BrandMark />
                  </div>
                  <div className="mt-4 rounded-md bg-secondary px-3 py-2.5">
                    <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                      {role}
                    </p>
                    <p className="mt-0.5 text-sm font-medium">{identity}</p>
                  </div>
                  <nav className="mt-4 flex flex-col gap-1">
                    {nav.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        activeOptions={{ exact: item.exact ?? false }}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-4 flex flex-col border-t border-border pt-3">
                    <Link
                      to="/"
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to portal
                    </Link>
                    <DashboardSignOut className="text-muted-foreground hover:text-foreground" />
                  </div>
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{role}</p>
                <h1 className="mt-1 truncate text-2xl font-semibold">{title}</h1>
                {subtitle ? (
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </div>
        {banner}
        <main id="main-content" className="min-w-0 flex-1 overflow-x-clip px-4 py-6 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "warning" | "success";
}) {
  const toneRing = {
    default: "border-border",
    accent: "border-accent/40",
    warning: "border-warning/50",
    success: "border-success/40",
  }[tone];

  return (
    <div className={cn("shadow-card rounded-lg border bg-card p-4", toneRing)}>
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Full-width strip between the header bar and the padded <main> — for alerts. */
  banner?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("shadow-card rounded-lg border border-border bg-card", className)}>
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
