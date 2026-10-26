import { queryOptions } from "@tanstack/react-query";

import { authApi } from "./api";
import { ApiError, clearAuthTokens } from "./client";
import { getStoredSession } from "./auth";
import type { AppRole, SessionUser } from "./types";

export const queryKeys = {
  auth: {
    session: () => ["auth", "session"] as const,
    me: () => ["auth", "me"] as const,
  },
  establishments: {
    mine: () => ["establishments", "mine"] as const,
    all: (f?: unknown) => ["establishments", "all", f] as const,
    byId: (id: string) => ["establishments", id] as const,
  },
  tiers: { list: () => ["tiers"] as const },
  levies: {
    mine: () => ["levies", "mine"] as const,
    all: (f?: unknown) => ["levies", "all", f] as const,
  },
  certificates: { mine: () => ["certificates", "mine"] as const },
  payments: { status: (ref: string) => ["payments", "status", ref] as const },
  inspections: {
    list: (f?: unknown) => ["inspections", f] as const,
    mine: () => ["inspections", "mine"] as const,
  },
  fines: { list: (f?: unknown) => ["fines", f] as const, mine: () => ["fines", "mine"] as const },
  notifications: { mine: () => ["notifications", "mine"] as const },
  admin: {
    dashboard: () => ["admin", "dashboard"] as const,
    defaulters: (f?: unknown) => ["admin", "defaulters", f] as const,
    audit: (f?: unknown) => ["admin", "audit", f] as const,
    users: (f?: unknown) => ["admin", "users", f] as const,
  },
};

/** Resolves the session: stored copy first, then live /users/me. */
export function sessionQuery() {
  return queryOptions({
    queryKey: queryKeys.auth.session(),
    queryFn: async (): Promise<SessionUser | null> => {
      try {
        const me = await authApi.me();
        const role = (me.roles[0] ?? "BusinessOwner") as AppRole;
        const session: SessionUser = {
          id: me.id,
          name: [me.firstName, me.lastName].filter(Boolean).join(" ") || (me.email ?? ""),
          email: me.email ?? "",
          role,
          roles: me.roles,
          emailConfirmed: me.emailConfirmed,
        };
        localStorage.setItem("lc_session", JSON.stringify(session));
        return session;
      } catch (err) {
        // A real auth rejection means the stored session is stale — clear it
        // rather than rendering the UI as logged-in. Network blips keep it.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearAuthTokens();
          return null;
        }
        return getStoredSession();
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}
