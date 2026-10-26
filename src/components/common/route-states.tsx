import { useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Shared error boundary UI for route loaders / suspense queries. */
export function RouteError({ error }: { error: unknown }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--brand-tint-soft)] text-[var(--brand)]">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <div>
        <h1 className="text-lg font-semibold">We couldn&apos;t load this page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "Something went wrong while talking to the service."}
        </p>
      </div>
      <Button onClick={() => void router.invalidate()}>Try again</Button>
    </div>
  );
}

/** Shared skeleton UI while a route loader resolves — shape-matches the typical
 * page layout (heading, stat row, content blocks) rather than a bare spinner. */
export function RoutePending({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="px-4 py-8 sm:px-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Shared empty-state block for lists with no results. */
export function RouteEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="font-medium">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** In-page error card for failed queries — retry refetches. */
export function QueryError({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
    >
      <p className="font-medium text-destructive">Couldn&apos;t load this</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Please try again."}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
