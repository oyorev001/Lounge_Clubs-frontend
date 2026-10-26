import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { getStoredSession, queryKeys, sessionQuery } from "@/services";
import type { AppRole, SessionUser } from "@/services";

/**
 * Synchronous session check used in route beforeLoad guards.
 * Reads React Query cache → localStorage → redirects to /login.
 */
export function requireSession(queryClient: QueryClient, redirectTo: string): SessionUser {
  const cached = queryClient.getQueryData<SessionUser | null>(queryKeys.auth.session());
  if (cached) return cached;

  const stored = getStoredSession();
  if (stored) {
    queryClient.setQueryData(queryKeys.auth.session(), stored);
    void queryClient.fetchQuery(sessionQuery()).catch(() => undefined);
    return stored;
  }

  throw redirect({ to: "/login", search: { redirect: redirectTo } });
}

/** Requires a session whose role is in `roles`. */
export function requireRole(
  queryClient: QueryClient,
  roles: AppRole[],
  redirectTo: string,
): SessionUser {
  const session = requireSession(queryClient, redirectTo);
  if (!roles.includes(session.role)) {
    throw redirect({ to: session.role === "BusinessOwner" ? "/dashboard" : "/admin" });
  }
  return session;
}
