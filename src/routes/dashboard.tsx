import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  FileBadge,
  LayoutDashboard,
  MailWarning,
  Receipt,
  Settings,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell, type DashboardNavItem } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth-guard";
import { authApi, isStaff } from "@/services";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context, location }) => {
    const session = requireSession(context.queryClient, location.href);
    // Staff land on the admin portal instead.
    if (isStaff(session.role)) throw redirect({ to: "/admin" });
    return { session };
  },
  component: DashboardLayout,
});

const NAV: DashboardNavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/establishments", label: "My Establishments", icon: Building2 },
  { to: "/dashboard/levies", label: "Levies", icon: Receipt },
  { to: "/dashboard/certificates", label: "Certificates", icon: FileBadge },
  { to: "/dashboard/fines", label: "Fines", icon: Scale },
  { to: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function DashboardLayout() {
  const { session } = Route.useRouteContext();

  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(session.email),
    onSuccess: () => toast.success("A new code is on its way"),
    onError: () => toast.error("Could not resend — try again shortly"),
  });

  return (
    <DashboardShell
      role="Business Owner"
      identity={session.name}
      nav={NAV}
      title="Owner Dashboard"
      subtitle="Manage your establishments, levies and certificates"
      banner={
        session.emailConfirmed === false ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-8">
            <MailWarning className="size-4 shrink-0 text-amber-600" />
            <p className="flex-1 text-sm text-amber-900">
              Confirm your email so certificates and receipts reach you — we sent a 6-digit code to{" "}
              <span className="font-medium">{session.email}</span>.
            </p>
            <Button asChild size="sm" variant="outline" className="border-amber-300">
              <Link to="/verify-email" search={{ email: session.email }}>
                Enter code
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-800 hover:text-amber-900"
              disabled={resend.isPending}
              onClick={() => resend.mutate()}
            >
              Resend
            </Button>
          </div>
        ) : null
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
