import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, MailCheck, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/services";

export const Route = createFileRoute("/_auth/verify-email")({
  component: VerifyEmailPage,
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s["email"] === "string" ? s["email"] : undefined,
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
});

function VerifyEmailPage() {
  const search = useSearch({ from: "/_auth/verify-email" });
  const email = search["email"] ?? "";
  const redirect = search["redirect"];
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const verify = useMutation({
    mutationFn: () => authApi.verifyEmail(email, code.trim()),
    onSuccess: () => {
      toast.success("Email verified — you can sign in now");
      void navigate({ to: "/login", search: redirect ? { redirect } : undefined });
    },
    onError: (err: Error) => toast.error(err.message || "Invalid or expired code"),
  });

  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: () => toast.success("A new code is on its way"),
    onError: (err: Error) => toast.error(err.message || "Could not resend"),
  });

  const noEmail = !email;

  if (noEmail) {
    return (
      <AuthShell>
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <h1 className="font-display text-lg font-semibold">No email address given</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This page needs the email you registered with. Sign in or register to get a
              verification link.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/login">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <MailCheck className="size-7 text-primary" />
            </span>
            <h1 className="font-display text-xl font-semibold">Confirm your email</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{email || "your email"}</span>. Enter it
              below — it expires in 30 minutes.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                ref={inputRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="● ● ● ● ● ●"
                className="text-center font-mono text-2xl tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6) verify.mutate();
                }}
              />
            </div>

            <Button
              className="w-full"
              disabled={code.length !== 6 || verify.isPending}
              onClick={() => verify.mutate()}
            >
              {verify.isPending ? "Verifying…" : "Verify email"}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <Link
                to="/register"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" /> Back
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-primary hover:underline disabled:opacity-50"
                disabled={resend.isPending || !email}
                onClick={() => resend.mutate()}
              >
                <RotateCw className={`size-3.5 ${resend.isPending ? "animate-spin" : ""}`} />
                Resend code
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
