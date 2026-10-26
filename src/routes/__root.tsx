import type { QueryClient } from "@tanstack/react-query";
import { RouteError } from "@/components/common/route-states";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  errorComponent: RouteError,
  component: () => (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Outlet />
      <Toaster richColors position="top-right" />
    </div>
  ),
});
