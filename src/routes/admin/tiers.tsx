import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireRole } from "@/lib/auth-guard";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { formatNaira, Pill } from "@/components/common/status-badges";
import { SectionCard } from "@/components/layout/dashboard-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin, queryKeys, tiersApi } from "@/services";
import type { LicenseTier } from "@/services";

export const Route = createFileRoute("/admin/tiers")({
  // Admin-only area — the parent guard only checks Admin|Officer.
  beforeLoad: ({ context }) => {
    const session = requireRole(context.queryClient, ["Admin"], "/admin/tiers");
    return { session };
  },
  component: TiersPage,
});

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

function TiersPage() {
  const { session } = useAuth();
  const admin = isAdmin(session?.role);
  const qc = useQueryClient();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.tiers.list(),
    queryFn: tiersApi.list,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LicenseTier | null>(null);
  const [deleting, setDeleting] = useState<LicenseTier | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => tiersApi.remove(id),
    onSuccess: () => {
      toast.success("Tier deleted");
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: queryKeys.tiers.list() });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="License tiers"
        description="Fee bands assigned on approval. The suggested tier is derived from the declared venue stats."
        actions={
          admin ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> New tier
            </Button>
          ) : undefined
        }
      >
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : isError ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Annual fee</TableHead>
                  <TableHead>Min. score</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead>Status</TableHead>
                  {admin ? <TableHead className="w-24" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{formatNaira(t.annualFee)}</TableCell>
                    <TableCell>{t.minScore}</TableCell>
                    <TableCell>{t.sortOrder}</TableCell>
                    <TableCell>
                      <Pill tone={t.isActive === false ? "neutral" : "positive"}>
                        {t.isActive === false ? "Inactive" : "Active"}
                      </Pill>
                    </TableCell>
                    {admin ? (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${t.name}`}
                            onClick={() => {
                              setEditing(t);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${t.name}`}
                            onClick={() => setDeleting(t)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <RouteEmpty title="No tiers configured" hint="Create the fee bands used at approval." />
        )}
      </SectionCard>

      <TierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tier={editing}
        onSaved={() => void qc.invalidateQueries({ queryKey: queryKeys.tiers.list() })}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Establishments already on this tier keep their tier; the tier just stops being
              selectable. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TierFormState {
  code: string;
  name: string;
  description: string;
  annualFee: string;
  sortOrder: string;
  minScore: string;
  isActive: boolean;
}

function TierFormDialog({
  open,
  onOpenChange,
  tier,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: LicenseTier | null;
  onSaved: () => void;
}) {
  const isEdit = tier !== null;
  const [form, setForm] = useState<TierFormState>({
    code: "",
    name: "",
    description: "",
    annualFee: "",
    sortOrder: "0",
    minScore: "0",
    isActive: true,
  });
  const [loadedFor, setLoadedFor] = useState<LicenseTier | null | "new">(null);

  // Reset form when the dialog target changes.
  const target = tier ?? "new";
  if (open && loadedFor !== target) {
    setLoadedFor(target);
    setForm({
      code: tier?.code ?? "",
      name: tier?.name ?? "",
      description: tier?.description ?? "",
      annualFee: tier ? String(tier.annualFee) : "",
      sortOrder: tier ? String(tier.sortOrder) : "0",
      minScore: tier ? String(tier.minScore) : "0",
      isActive: tier?.isActive !== false,
    });
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        annualFee: Number(form.annualFee),
        sortOrder: Number(form.sortOrder) || 0,
        minScore: Number(form.minScore) || 0,
      };
      return tier
        ? tiersApi.update(tier.id, { ...body, isActive: form.isActive })
        : tiersApi.create({ code: form.code.trim().toUpperCase(), ...body });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Tier updated" : "Tier created");
      onOpenChange(false);
      onSaved();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const valid =
    form.name.trim().length > 0 &&
    (isEdit || form.code.trim().length > 0) &&
    Number.isFinite(Number(form.annualFee)) &&
    Number(form.annualFee) >= 0;

  const set = <K extends keyof TierFormState>(k: K, v: TierFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${tier.name}` : "New license tier"}</DialogTitle>
          <DialogDescription>
            Tiers drive the annual levy amount billed on approval.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tier-code">Code</Label>
            <Input
              id="tier-code"
              value={form.code}
              disabled={isEdit}
              onChange={(e) => set("code", e.target.value)}
              placeholder="e.g. GOLD"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-name">Name</Label>
            <Input
              id="tier-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Gold"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-fee">Annual fee (₦)</Label>
            <Input
              id="tier-fee"
              type="number"
              min={0}
              value={form.annualFee}
              onChange={(e) => set("annualFee", e.target.value)}
              placeholder="150000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-minscore">Minimum score</Label>
            <Input
              id="tier-minscore"
              type="number"
              min={0}
              value={form.minScore}
              onChange={(e) => set("minScore", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-sort">Sort order</Label>
            <Input
              id="tier-sort"
              type="number"
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value)}
            />
          </div>
          {isEdit ? (
            <div className="flex items-end gap-2 pb-1">
              <Checkbox
                id="tier-active"
                checked={form.isActive}
                onCheckedChange={(v) => set("isActive", v === true)}
              />
              <Label htmlFor="tier-active">Active (selectable)</Label>
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tier-desc">Description (optional)</Label>
          <Textarea
            id="tier-desc"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Create tier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
