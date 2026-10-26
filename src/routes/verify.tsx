import { createFileRoute, Outlet } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/layout/site-chrome";

export const Route = createFileRoute("/verify")({
  component: () => (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  ),
});
