import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { format } from "date-fns";
import { CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { notificationsApi, queryKeys } from "@/services";
import type { AppNotification } from "@/services";

export const Route = createFileRoute("/dashboard/notifications")({ component: NotificationsPage });

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : format(d, "dd MMM yyyy, HH:mm");
}

function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const notifications = useQuery({
    queryKey: [...queryKeys.notifications.mine(), page],
    queryFn: () => notificationsApi.mine(page),
    placeholderData: keepPreviousData,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.mine() });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      void invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update notifications"),
  });

  const open = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link && n.link.startsWith("/")) router.history.push(n.link);
  };

  const items = notifications.data?.items.data ?? [];
  const meta = notifications.data?.items.meta;

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Notifications"
        description="Updates on your establishments, levies and certificates"
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={markAll.isPending || !items.some((n) => !n.isRead)}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        }
      >
        {notifications.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : notifications.isError ? (
          <QueryError error={notifications.error} onRetry={() => void notifications.refetch()} />
        ) : items.length ? (
          <>
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40",
                      !n.isRead && "border-l-2 border-accent bg-accent/5",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        n.isRead ? "bg-transparent" : "bg-accent",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn("block text-sm", !n.isRead ? "font-semibold" : "font-medium")}
                      >
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {n.message}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDate(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {meta && meta.last_page > 1 ? (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  Page {meta.current_page} of {meta.last_page} ({meta.total} total)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= meta.last_page}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <RouteEmpty title="No notifications" hint="You're all caught up." />
        )}
      </SectionCard>
    </div>
  );
}
