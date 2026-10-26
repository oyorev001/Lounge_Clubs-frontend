// Session storage + role helpers.

import type { AppRole, SessionUser } from "./types";
import { clearAuthTokens } from "./client";

const SESSION_KEY = "lc_session";

const STAFF_ROLES: AppRole[] = ["Admin", "Officer"];

export function saveSession(user: SessionUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function getStoredSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  clearAuthTokens();
}

export function isStaff(role: AppRole | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function canReview(role: AppRole | undefined): boolean {
  return role === "Officer" || role === "Admin";
}

export function canFinance(role: AppRole | undefined): boolean {
  return role === "Admin";
}

export function canEnforce(role: AppRole | undefined): boolean {
  return role === "Officer" || role === "Admin";
}

export function isAdmin(role: AppRole | undefined): boolean {
  return role === "Admin";
}

/** Default landing route after login, by role. */
export function roleHome(role: AppRole | undefined): string {
  if (!role) return "/login";
  return isStaff(role) ? "/admin" : "/dashboard";
}
