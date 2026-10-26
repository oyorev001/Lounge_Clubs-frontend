import { cn } from "@/lib/utils";
import type {
  CertificateStatus,
  EstablishmentStatus,
  FineStatus,
  InspectionOutcome,
  LevyStatus,
  PaymentStatus,
} from "@/services";

type Tone = "neutral" | "positive" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  positive: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/18 text-warning-foreground border-warning/40",
  danger: "bg-destructive/12 text-destructive border-destructive/30",
  info: "bg-info/12 text-info border-info/30",
};

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

const establishmentTone: Record<EstablishmentStatus, Tone> = {
  PendingReview: "warning",
  Approved: "positive",
  Rejected: "danger",
  Suspended: "danger",
  NonCompliant: "danger",
  Closed: "neutral",
};

const establishmentLabel: Record<EstablishmentStatus, string> = {
  PendingReview: "Pending review",
  Approved: "Approved",
  Rejected: "Rejected",
  Suspended: "Suspended",
  NonCompliant: "Non-compliant",
  Closed: "Deregistered",
};

export function EstablishmentStatusBadge({ status }: { status: EstablishmentStatus }) {
  return (
    <Pill tone={establishmentTone[status]}>{establishmentLabel[status] ?? humanize(status)}</Pill>
  );
}

const levyTone: Record<LevyStatus, Tone> = {
  Pending: "warning",
  Paid: "positive",
  Overdue: "danger",
  Waived: "neutral",
};

export function LevyStatusBadge({ status }: { status: LevyStatus }) {
  return <Pill tone={levyTone[status]}>{humanize(status)}</Pill>;
}

const paymentTone: Record<PaymentStatus, Tone> = {
  Pending: "warning",
  AwaitingConfirmation: "warning",
  Successful: "positive",
  Failed: "danger",
  Cancelled: "neutral",
  Refunded: "neutral",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Pill tone={paymentTone[status]}>{humanize(status)}</Pill>;
}

const certTone: Record<CertificateStatus, Tone> = {
  Active: "positive",
  Expired: "warning",
  Revoked: "danger",
};

export function CertificateStatusBadge({ status }: { status: CertificateStatus }) {
  return <Pill tone={certTone[status]}>{humanize(status)}</Pill>;
}

const fineTone: Record<FineStatus, Tone> = {
  Unpaid: "danger",
  Paid: "positive",
  Waived: "neutral",
};

export function FineStatusBadge({ status }: { status: FineStatus }) {
  return <Pill tone={fineTone[status]}>{humanize(status)}</Pill>;
}

const inspectionTone: Record<InspectionOutcome, Tone> = {
  Compliant: "positive",
  Issues: "warning",
  Critical: "danger",
};

export function InspectionOutcomeBadge({ outcome }: { outcome: InspectionOutcome | null }) {
  if (!outcome) return <Pill tone="neutral">Scheduled</Pill>;
  return <Pill tone={inspectionTone[outcome]}>{outcome}</Pill>;
}

/** "AwaitingConfirmation" → "Awaiting confirmation" for raw status renders. */
function humanize(s: string) {
  return s.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
