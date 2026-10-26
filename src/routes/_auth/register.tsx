import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { PENDING_TYPES_KEY, VENUE_TYPES } from "@/lib/oyo";
import { cn } from "@/lib/utils";
import { authApi } from "@/services";
import type { EstablishmentType } from "@/services";

export const Route = createFileRoute("/_auth/register")({ component: RegisterPage });

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [types, setTypes] = useState<EstablishmentType[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    businessName: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);

  const toggleType = (t: EstablishmentType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 10) {
      toast.error("Password must be at least 10 characters");
      return;
    }
    if (!form.businessName.trim()) {
      toast.error("Business name is required — it goes on your certificate.");
      return;
    }
    setBusy(true);
    try {
      await authApi.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        businessName: form.businessName.trim(),
        password: form.password,
      });
      // Carry the chosen venue types into the dashboard registration wizard.
      localStorage.setItem(PENDING_TYPES_KEY, JSON.stringify(types));
      toast.success("Account created — check your email for the verification code.");
      void navigate({
        to: "/verify-email",
        search: {
          email: form.email.trim(),
          redirect: "/dashboard/establishments/register",
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell wide>
      {step === 0 ? (
        <Card className="w-full max-w-2xl">
          <CardHeader className="pb-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Step 1 of 2 — Venue type
            </p>
            <CardTitle className="font-display text-2xl">
              What does your establishment operate?
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Select every type that applies — a bar that also runs a lounge picks both. Your levy
              is assessed on the highest category.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {VENUE_TYPES.map((v) => {
                const selected = types.includes(v.type);
                return (
                  <button
                    key={v.type}
                    type="button"
                    onClick={() => toggleType(v.type)}
                    className={cn(
                      "group overflow-hidden rounded-xl border text-left transition-all",
                      selected
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="relative h-24 overflow-hidden">
                      <img
                        src={v.image}
                        alt={v.type}
                        className="size-full object-cover object-top transition-transform group-hover:scale-105"
                      />
                      {selected ? (
                        <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3.5" />
                        </span>
                      ) : null}
                    </div>
                    <div className="px-3 py-2">
                      <p className="font-semibold">{v.type}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.blurb}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {types.length === 0 ? (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Select at least one venue type to continue.
              </p>
            ) : null}
            <Button
              className={`w-full ${types.length === 0 ? "mt-1.5 opacity-50" : "mt-4"}`}
              disabled={types.length === 0}
              onClick={() => setStep(1)}
            >
              Continue — create your account <ArrowRight className="size-4" />
            </Button>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-xl">
          <CardHeader className="pb-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Step 2 of 2 — Your account
            </p>
            <CardTitle className="font-display text-2xl">Create your account</CardTitle>
            <p className="text-sm text-muted-foreground">
              Registering {types.join(" + ")} —{" "}
              <button
                type="button"
                onClick={() => setStep(0)}
                className="font-medium text-brand hover:underline"
              >
                change
              </button>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    required
                    value={form.firstName}
                    onChange={set("firstName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" required value={form.lastName} onChange={set("lastName")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessName">Business name</Label>
                <Input
                  id="businessName"
                  required
                  value={form.businessName}
                  onChange={set("businessName")}
                  placeholder="e.g. De Roca Lounge"
                />
                <p className="text-xs text-muted-foreground">
                  The trading name on your CAC registration — used on your certificate.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={set("email")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="0803 000 0000"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={set("password")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <PasswordInput
                    id="confirm"
                    required
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={set("confirm")}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters, at least one digit.
              </p>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating account…" : "Create account & continue"}
              </Button>
            </form>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </AuthShell>
  );
}
