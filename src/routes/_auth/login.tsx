import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/hooks/use-auth";
import { authApi, queryKeys, roleHome, saveSession, setTokens } from "@/services";
import type { AppRole } from "@/services";

export const Route = createFileRoute("/_auth/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: (s["redirect"] as string) || undefined,
  }),
  component: LoginPage,
});

/** Only internal app paths may be redirect targets — anything else → default. */
function safeRedirect(path: string | undefined | null): string | undefined {
  if (!path || !/^\/(dashboard|admin|payment-callback)(\/|$)/.test(path)) return undefined;
  return path;
}

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { redirect: redirectTo } = Route.useSearch();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const tokens = await authApi.login(email.trim(), password);
      setTokens(tokens.accessToken, tokens.refreshToken);
      const me = await authApi.me();
      const role = (me.roles[0] ?? "BusinessOwner") as AppRole;
      const session = {
        id: me.id,
        name: [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email || "",
        email: me.email ?? "",
        role,
        roles: me.roles,
        emailConfirmed: me.emailConfirmed,
      };
      saveSession(session);
      queryClient.setQueryData(queryKeys.auth.session(), session);
      toast.success("Welcome back");
      void navigate({ to: safeRedirect(redirectTo) ?? roleHome(role) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  // Already signed in? Skip the form — via effect, never during render.
  useEffect(() => {
    if (session) void navigate({ to: safeRedirect(redirectTo) ?? roleHome(session.role) });
  }, [session, navigate, redirectTo]);
  if (session) return null;

  return (
    <AuthShell>
      <Card className="w-full border-border/70 shadow-lg">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Access your compliance dashboard</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
            <Link to="/register" className="font-medium text-brand hover:underline">
              Register
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
