import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/hooks/use-auth";
import { authApi, queryKeys } from "@/services";

/**
 * Shared account settings — profile fields (PUT /users/profile) and password
 * change (POST /auth/change-password). Mounted by both /dashboard/settings
 * and /admin/settings so every role gets the same surface.
 */
export function SettingsPanel() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [profile, setProfile] = useState({ firstName: "", lastName: "", phoneNumber: "" });
  const me = useQuery({ queryKey: queryKeys.auth.me(), queryFn: authApi.me });

  // Pre-fill once — server record has real first/last names, not the
  // session's space-joined display name (which mangles multi-word names).
  const prefilled = useRef(false);
  useEffect(() => {
    const u = me.data;
    if (!u || prefilled.current) return;
    prefilled.current = true;
    setProfile({
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      phoneNumber: u.phoneNumber ?? "",
    });
  }, [me.data]);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const saveProfile = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        ...(profile.phoneNumber.trim() ? { phoneNumber: profile.phoneNumber.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      void qc.invalidateQueries({ queryKey: queryKeys.auth.session() });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save profile"),
  });

  const changePw = useMutation({
    mutationFn: () => authApi.changePassword(pw.current, pw.next),
    onSuccess: () => {
      toast.success("Password changed — sign in again on other devices");
      setPw({ current: "", next: "", confirm: "" });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't change password"),
  });

  const pwReady = pw.current.length > 0 && pw.next.length >= 10 && pw.next === pw.confirm;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionCard title="Profile" description="Your name and contact number.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="s-fname">First name</Label>
            <Input
              id="s-fname"
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-lname">Last name</Label>
            <Input
              id="s-lname"
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="s-phone">Phone</Label>
            <Input
              id="s-phone"
              type="tel"
              value={profile.phoneNumber}
              onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
              placeholder="0803 000 0000"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Email</Label>
            <Input value={session?.email ?? ""} disabled readOnly />
            <p className="text-xs text-muted-foreground">Email can't be changed.</p>
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={saveProfile.isPending || !profile.firstName.trim() || !profile.lastName.trim()}
          onClick={() => saveProfile.mutate()}
        >
          <UserRound className="size-4" />
          {saveProfile.isPending ? "Saving…" : "Save profile"}
        </Button>
      </SectionCard>

      <SectionCard
        title="Change password"
        description="Takes effect immediately — your other sessions are signed out."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-pw-cur">Current password</Label>
            <PasswordInput
              id="s-pw-cur"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-pw-new">New password</Label>
              <PasswordInput
                id="s-pw-new"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-pw-cnf">Confirm new password</Label>
              <PasswordInput
                id="s-pw-cnf"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </div>
          </div>
          {pw.next && pw.next.length < 10 ? (
            <p className="text-xs text-destructive">Minimum 10 characters.</p>
          ) : null}
          {pw.confirm && pw.next !== pw.confirm ? (
            <p className="text-xs text-destructive">Passwords don't match.</p>
          ) : null}
        </div>
        <Button
          className="mt-4"
          variant="outline"
          disabled={!pwReady || changePw.isPending}
          onClick={() => changePw.mutate()}
        >
          <KeyRound className="size-4" />
          {changePw.isPending ? "Changing…" : "Change password"}
        </Button>
      </SectionCard>
    </div>
  );
}
