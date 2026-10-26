import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireRole } from "@/lib/auth-guard";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Ban, Plus, RotateCcw, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { useDebounced } from "@/hooks/use-debounced";
import { toast } from "sonner";

import { PaginationControls } from "@/components/common/pagination";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OYO_LGAS } from "@/lib/oyo";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin, usersApi } from "@/services";
import type { AdminUserItem, AppRole } from "@/services";

export const Route = createFileRoute("/admin/users")({
  // Admin-only area — the parent guard only checks Admin|Officer.
  beforeLoad: ({ context }) => {
    const session = requireRole(context.queryClient, ["Admin"], "/admin/users");
    return { session };
  },
  component: UsersPage,
});

const ALL = "all";
const STAFF_ROLES: AppRole[] = ["Officer", "Admin"];

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

function UsersPage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(""); // "" = all current roles
  const [showStale, setShowStale] = useState(false);
  const debouncedSearch = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleFor, setRoleFor] = useState<AdminUserItem | null>(null);
  const [lgaFor, setLgaFor] = useState<AdminUserItem | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["admin", "users", { search: debouncedSearch, roleFilter, showStale, page }],
    queryFn: () =>
      usersApi.list({
        ...(roleFilter ? { role: roleFilter } : {}),
        current_roles_only: !showStale || !!roleFilter,
        page,
        per_page: 15,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
  });

  const toggleActive = useMutation({
    mutationFn: (u: AdminUserItem) =>
      u.isActive ? usersApi.deactivate(u.id) : usersApi.reactivate(u.id),
    onSuccess: (_d, u) => {
      toast.success(u.isActive ? "User deactivated" : "User reactivated");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const meta = data?.meta;

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Users & staff"
        description="All portal accounts — business owners and government staff."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative sm:w-64">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name or email"
                className="pl-8"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v === ALL ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="All current roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All current roles</SelectItem>
                {(["Admin", "Officer", "BusinessOwner"] as const).map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace(/([a-z])([A-Z])/g, "$1 $2")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="size-4" /> New staff account
            </Button>
          </div>
        }
      >
        <div className="mb-3 flex items-center gap-2">
          <input
            id="show-stale"
            type="checkbox"
            className="size-4 accent-primary"
            checked={showStale}
            onChange={(e) => {
              setShowStale(e.target.checked);
              setPage(1);
            }}
          />
          <label htmlFor="show-stale" className="text-xs text-muted-foreground">
            Include accounts with stale roles (removed roles like "Finance" — for cleanup)
          </label>
        </div>
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : isError ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data && data.data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.userName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length ? (
                            u.roles.map((r) =>
                              ["Admin", "Officer", "BusinessOwner"].includes(r) ? (
                                <Badge key={r} variant="secondary" className="text-xs">
                                  {r}
                                </Badge>
                              ) : (
                                <Badge
                                  key={r}
                                  variant="outline"
                                  className="border-amber-400 text-xs text-amber-700"
                                >
                                  {r} (removed role)
                                </Badge>
                              ),
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-rose-300 text-rose-700">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setRoleFor(u)}>
                            <Plus className="size-3.5" /> Role
                          </Button>
                          {u.roles.includes("Officer") ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              title={
                                u.assignedLgas?.length
                                  ? `Scoped to: ${u.assignedLgas.join(", ")}`
                                  : "Statewide — click to restrict by LGA"
                              }
                              onClick={() => setLgaFor(u)}
                            >
                              <MapPin className="size-3.5" />
                              {u.assignedLgas?.length ? u.assignedLgas.length : "LGAs"}
                            </Button>
                          ) : null}
                          <Button
                            size="icon"
                            variant="ghost"
                            title={u.isActive ? "Deactivate user" : "Reactivate user"}
                            // Never let an admin lock themselves out mid-session.
                            disabled={toggleActive.isPending || u.id === session?.id}
                            onClick={() => {
                              if (
                                !u.isActive ||
                                window.confirm(
                                  `Deactivate ${u.firstName ?? ""} ${u.lastName ?? ""} (${u.email})? They will be signed out immediately.`,
                                )
                              )
                                toggleActive.mutate(u);
                            }}
                          >
                            <Ban className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {meta && meta.last_page > 1 ? (
              <div className="mt-4">
                <PaginationControls
                  index={meta.current_page - 1}
                  totalPages={meta.last_page}
                  total={meta.total}
                  pageSize={meta.per_page}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                />
              </div>
            ) : null}
          </>
        ) : (
          <RouteEmpty title="No users found" hint="Try a different search." />
        )}
      </SectionCard>

      <CreateStaffDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["admin", "users"] })}
      />
      <JurisdictionDialog user={lgaFor} onClose={() => setLgaFor(null)} />
      <AssignRoleDialog
        user={roleFor}
        onClose={() => setRoleFor(null)}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["admin", "users"] })}
      />
    </div>
  );
}

function CreateStaffDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const admin = isAdmin(session?.role);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    role: "Officer" as string,
  });
  const create = useMutation({
    mutationFn: () =>
      usersApi.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phone.trim(),
        password: form.password,
        roles: [form.role],
      }),
    onSuccess: () => {
      toast.success("Staff account created");
      setForm({ firstName: "", lastName: "", email: "", phone: "", password: "", role: "Officer" });
      onOpenChange(false);
      onSaved();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New staff account</DialogTitle>
          <DialogDescription>
            Create a government staff login. Share the password securely.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cs-fn">First name</Label>
            <Input
              id="cs-fn"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-ln">Last name</Label>
            <Input
              id="cs-ln"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-email">Email</Label>
          <Input
            id="cs-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-phone">Phone</Label>
          <Input
            id="cs-phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-role">Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAFF_ROLES.filter((r) => admin || r !== "Admin").map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-pw">Temporary password</Label>
          <PasswordInput
            id="cs-pw"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !form.firstName.trim() ||
              !form.lastName.trim() ||
              !form.email.trim() ||
              !form.phone.trim() ||
              // Staff passwords match the owner policy — 10+ chars and a digit.
              form.password.length < 10 ||
              !/\d/.test(form.password) ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ||
              create.isPending
            }
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignRoleDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<string>("Officer");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (user && loadedFor !== user.id) {
    setLoadedFor(user.id);
    setRole("Officer");
  }
  const assign = useMutation({
    mutationFn: () => usersApi.assignRole(user!.id, role),
    onSuccess: () => {
      toast.success(`Assigned ${role}`);
      onClose();
      onSaved();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (r: string) => usersApi.removeRole(user!.id, r),
    onSuccess: () => {
      toast.success("Role removed");
      onSaved();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={user !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Roles — {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email}
          </DialogTitle>
          <DialogDescription>Current roles are listed; add a new role below.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {user?.roles.length ? (
            user.roles.map((r) => (
              <Badge key={r} variant="secondary" className="gap-1">
                {r}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${r}`}
                  onClick={() => remove.mutate(r)}
                >
                  ×
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No roles</span>
          )}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label>Add role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...STAFF_ROLES, "BusinessOwner"].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={assign.isPending || user?.roles.includes(role)}
            onClick={() => assign.mutate()}
          >
            Assign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JurisdictionDialog({
  user,
  onClose,
}: {
  user: AdminUserItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const save = useMutation({
    mutationFn: () => usersApi.setJurisdiction(user!.id, [...selected]),
    onSuccess: () => {
      toast.success("Jurisdiction saved");
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save jurisdiction"),
  });

  useEffect(() => {
    setSelected(new Set(user?.assignedLgas ?? []));
  }, [user]);

  return (
    <Dialog open={user !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Jurisdiction — {user?.firstName} {user?.lastName}
          </DialogTitle>
          <DialogDescription>
            Which LGAs can this officer act on? Leave all unchecked for statewide access.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {OYO_LGAS.map((lga) => (
            <label
              key={lga}
              className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={selected.has(lga)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(lga);
                  else next.delete(lga);
                  setSelected(next);
                }}
              />
              {lga}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : `Save ${selected.size || "statewide"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
