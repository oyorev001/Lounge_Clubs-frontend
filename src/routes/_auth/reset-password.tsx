import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/services";

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: (s["token"] as string) || "",
    email: (s["email"] as string) || "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, email } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10 || !/\d/.test(password)) {
      toast.error("Password must be at least 10 characters and include a number.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(email, token, password);
      toast.success("Password updated — sign in with your new password");
      void navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const linkInvalid = !token || !email;

  return (
    <AuthShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {linkInvalid ? (
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or incomplete. Request a new one from the{" "}
              <Link to="/forgot-password" className="text-brand hover:underline">
                forgot password
              </Link>{" "}
              page.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={10}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm">
            <Link to="/login" className="text-brand hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
