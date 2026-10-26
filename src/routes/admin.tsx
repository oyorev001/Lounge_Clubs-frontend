import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  FileBadge,
  LayoutDashboard,
  Megaphone,
  Receipt,
  Scale,
  ScrollText,
  Settings,
  Tags,
  Users,
} from "lucide-react";

import { DashboardShell, type DashboardNavItem } from "@/components/layout/dashboard-shell";
import { requireRole } from "@/lib/auth-guard";
import type { AppRole } from "@/services";

const STAFF: AppRole[] = ["Admin", "Officer"];

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context, location }) => {
    const session = requireRole(context.queryClient, STAFF, location.href);
    return { session };
  },
  component: AdminLayout,
});

type StaffNavItem = DashboardNavItem & { adminOnly?: boolean };

// Officers see the operational surface; user administration, tier
// management and the audit trail are Admin-only.
const NAV: StaffNavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/establishments", label: "Establishments", icon: Building2 },
  { to: "/admin/tiers", label: "Tiers", icon: Tags, adminOnly: true },
  { to: "/admin/levies", label: "Levies", icon: Receipt },
  { to: "/admin/defaulters", label: "Defaulters", icon: AlertTriangle },
  { to: "/admin/inspections", label: "Inspections", icon: ClipboardList },
  { to: "/admin/complaints", label: "Complaints", icon: Megaphone },
  { to: "/admin/fines", label: "Fines", icon: Scale },
  { to: "/admin/certificates", label: "Certificates", icon: FileBadge },
  { to: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText, adminOnly: true },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const { session } = Route.useRouteContext();
  const nav = NAV.filter((item) => !item.adminOnly || session.role === "Admin");
  return (
    <DashboardShell
      role={session.role}
      identity={session.name}
      nav={nav}
      title="Staff Portal"
      subtitle="Compliance operations — Oyo State"
    >
      <Outlet />
    </DashboardShell>
  );
}
