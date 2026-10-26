import { useQuery } from "@tanstack/react-query";
import { requireRole } from "@/lib/auth-guard";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FileText, Minus, Plus, User } from "lucide-react";
import { useEffect, useState } from "react";

import { PaginationControls } from "@/components/common/pagination";
import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { Pill } from "@/components/common/status-badges";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, queryKeys } from "@/services";

export const Route = createFileRoute("/admin/audit")({
  // Admin-only area — the parent guard only checks Admin|Officer.
  beforeLoad: ({ context }) => {
    const session = requireRole(context.queryClient, ["Admin"], "/admin/audit");
    return { session };
  },
  component: AuditPage,
});

const PAGE_SIZE = 15;

function fmtDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-NG");
}

type JsonMap = Record<string, unknown>;

function parseMap(raw: string | null): JsonMap {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as JsonMap) : {};
  } catch {
    return {};
  }
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** A single changed field: label + old→new for Modified, value for Add/Delete. */
function DiffRow({
  field,
  oldVal,
  newVal,
  kind,
}: {
  field: string;
  oldVal?: unknown;
  newVal?: unknown;
  kind: "added" | "removed" | "changed";
}) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 border-b border-border/50 py-1 text-xs last:border-0">
      <span className="truncate pt-0.5 font-medium text-muted-foreground" title={field}>
        {field}
      </span>
      {kind === "changed" ? (
        <span className="flex flex-wrap items-center gap-1">
          <span className="rounded bg-rose-500/10 px-1.5 font-mono text-[11px] text-rose-700 line-through dark:text-rose-400">
            {fmtVal(oldVal)}
          </span>
          <ChevronRight className="size-3 text-muted-foreground" />
          <span className="rounded bg-emerald-500/10 px-1.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
            {fmtVal(newVal)}
          </span>
        </span>
      ) : kind === "added" ? (
        <span className="rounded bg-emerald-500/10 px-1.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
          {fmtVal(newVal)}
        </span>
      ) : (
        <span className="rounded bg-rose-500/10 px-1.5 font-mono text-[11px] text-rose-700 line-through dark:text-rose-400">
          {fmtVal(oldVal)}
        </span>
      )}
    </div>
  );
}

/** Renders only the fields that actually changed — not the whole entity. */
function AuditDiff({
  oldRaw,
  newRaw,
  type,
}: {
  oldRaw: string | null;
  newRaw: string | null;
  type: string;
}) {
  const oldVals = parseMap(oldRaw);
  const newVals = parseMap(newRaw);
  const fields = [...new Set([...Object.keys(oldVals), ...Object.keys(newVals)])].sort();
  if (!fields.length)
    return <p className="py-2 text-xs text-muted-foreground">No field values recorded.</p>;
  return (
    <div className="rounded-md bg-muted/40 px-3 py-1">
      {fields.map((f) => {
        const inOld = f in oldVals;
        const inNew = f in newVals;
        const kind = type === "Added" ? "added" : type === "Deleted" ? "removed" : "changed";
        return (
          <DiffRow
            key={f}
            field={f}
            kind={kind}
            oldVal={inOld ? oldVals[f] : undefined}
            newVal={inNew ? newVals[f] : undefined}
          />
        );
      })}
    </div>
  );
}

const EVENTS = [
  { k: "", l: "All" },
  { k: "Added", l: "Added" },
  { k: "Modified", l: "Modified" },
  { k: "Deleted", l: "Deleted" },
] as const;

const TABLES = [
  "Establishments",
  "Certificates",
  "LevyAssessments",
  "Transactions",
  "Fines",
  "Inspections",
  "Complaints",
  "AspNetUsers",
  "LicenseTiers",
];

function AuditPage() {
  const [tableName, setTableName] = useState("");
  const [eventType, setEventType] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [tableName, eventType, userId, from, to]);

  const params = {
    page,
    per_page: PAGE_SIZE,
    ...(tableName ? { tableName } : {}),
    ...(eventType ? { type: eventType } : {}),
    ...(userId.trim() ? { userId: userId.trim() } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.audit(params),
    queryFn: () => adminApi.auditLogs(params),
  });

  const meta = data?.meta;

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Audit log"
        description="Every write to a compliance record, in order. Expand a row to inspect the old and new values."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Select value={tableName} onValueChange={(v) => setTableName(v === "all" ? "" : v)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="All tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tables</SelectItem>
                {TABLES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID"
              className="sm:w-48"
            />
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From date"
              className="sm:w-36"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
              className="sm:w-36"
            />
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {EVENTS.map((e) => (
            <button
              key={e.k}
              type="button"
              onClick={() => setEventType(e.k)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold ring-1 transition",
                eventType === e.k
                  ? "bg-foreground text-background ring-foreground"
                  : "bg-muted/60 text-muted-foreground ring-border hover:bg-muted",
              )}
            >
              {e.l}
            </button>
          ))}
        </div>
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : data && data.data.length > 0 ? (
          <>
            <div className="space-y-2">
              {data.data.map((row) => (
                <details
                  key={row.id}
                  className={cn(
                    "group rounded-lg border border-border bg-card transition open:border-primary/40",
                    row.type === "Added" && "border-l-4 border-l-emerald-500",
                    row.type === "Modified" && "border-l-4 border-l-blue-400",
                    row.type === "Deleted" && "border-l-4 border-l-rose-500",
                  )}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{row.tableName}</span>
                        <Pill
                          tone={
                            row.type === "Deleted"
                              ? "danger"
                              : row.type === "Added"
                                ? "positive"
                                : "info"
                          }
                        >
                          {row.type}
                        </Pill>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {row.primaryKey.length > 13
                            ? `${row.primaryKey.slice(0, 13)}…`
                            : row.primaryKey}
                        </span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                        <span>{fmtDateTime(row.timestamp)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" />
                          <span className="max-w-40 truncate font-mono">
                            {row.userId ?? "system"}
                          </span>
                        </span>
                        <span>·</span>
                        <span>{row.ipAddress ?? "—"}</span>
                      </p>
                    </div>
                  </summary>
                  <div className="border-t border-border/60 px-4 py-2">
                    <AuditDiff oldRaw={row.oldValues} newRaw={row.newValues} type={row.type} />
                  </div>
                </details>
              ))}
            </div>
            {meta ? (
              <PaginationControls
                index={meta.current_page - 1}
                totalPages={meta.last_page}
                total={meta.total}
                pageSize={meta.per_page}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              />
            ) : null}
          </>
        ) : (
          <RouteEmpty
            title="No audit entries"
            hint="Widen the filters — writes are logged as they happen."
          />
        )}
      </SectionCard>
    </div>
  );
}
