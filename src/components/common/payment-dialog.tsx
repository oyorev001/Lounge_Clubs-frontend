import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Download, ExternalLink, Loader2, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { formatNaira } from "@/components/common/status-badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentsApi, queryKeys, saveBlobAs } from "@/services";
import type { TransactionInit } from "@/services";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initiate: (idempotencyKey: string) => Promise<TransactionInit>;
}

function CopyRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  const copy = () => {
    if (!value) return;
    void navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Could not copy to clipboard"));
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
        <p
          className={
            mono ? "truncate font-mono text-sm font-medium" : "truncate text-sm font-medium"
          }
        >
          {value ?? "—"}
        </p>
      </div>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={copy}
          aria-label={`Copy ${label}`}
        >
          <Copy className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PaymentDialog({
  open,
  onOpenChange,
  title,
  description,
  initiate,
}: PaymentDialogProps) {
  const queryClient = useQueryClient();
  const [txn, setTxn] = useState<TransactionInit | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const openedRef = useRef(false);
  const notifiedRef = useRef(false);

  const start = useMutation({
    mutationFn: () => initiate(crypto.randomUUID()),
    onSuccess: (res) => setTxn(res),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not start the payment"),
  });

  // Kick off a fresh transaction each time the dialog opens.
  useEffect(() => {
    if (open && !openedRef.current) {
      openedRef.current = true;
      notifiedRef.current = false;
      setTxn(null);
      start.reset();
      start.mutate();
    }
    if (!open) openedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const statusQuery = useQuery({
    queryKey: queryKeys.payments.status(txn?.reference ?? "none"),
    queryFn: () => paymentsApi.status(txn!.reference),
    enabled: Boolean(txn?.reference),
    refetchInterval: (q) =>
      q.state.data?.status === "Pending" || q.state.data?.status === "AwaitingConfirmation"
        ? 10_000
        : false,
  });

  const status = statusQuery.data?.status ?? txn?.status ?? "Pending";
  const paid = status === "Successful";
  const failureReason = statusQuery.data?.failureReason;
  const dead = status === "Failed" || status === "Cancelled" || status === "Refunded";

  // Confirm once: toast + refresh affected lists.
  useEffect(() => {
    if (notifiedRef.current) return;
    if (status === "Successful") {
      notifiedRef.current = true;
      toast.success("Payment confirmed");
      void queryClient.invalidateQueries({ queryKey: ["levies"] });
      void queryClient.invalidateQueries({ queryKey: ["certificates"] });
      void queryClient.invalidateQueries({ queryKey: ["fines"] });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
    } else if (status === "Failed" || status === "Cancelled" || status === "Refunded") {
      notifiedRef.current = true;
      toast.error(
        status === "Failed"
          ? "Payment failed — please try again"
          : `Payment ${status.toLowerCase()}`,
      );
    }
  }, [status, queryClient]);

  // Countdown ticker for the checkout link expiry.
  useEffect(() => {
    if (!txn?.expiresAt || paid) return;
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [txn?.expiresAt, paid]);

  const remainingMs = txn?.expiresAt ? new Date(txn.expiresAt).getTime() - now : null;
  const expired = remainingMs !== null && remainingMs <= 0 && !paid;

  const receipt = useMutation({
    mutationFn: () => paymentsApi.receiptPdf(txn!.transactionId),
    onSuccess: (res) => saveBlobAs(res),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not download receipt"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {start.isPending || (!txn && !start.isError) ? (
          <div className="space-y-3" role="status">
            <span className="sr-only">Setting up payment…</span>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : start.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">We couldn&apos;t start this payment.</p>
            <Button variant="outline" size="sm" onClick={() => start.mutate()}>
              Try again
            </Button>
          </div>
        ) : txn ? (
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <CopyRow label="Amount" value={formatNaira(txn.amount)} />
              <CopyRow label="Reference" value={txn.reference} mono />
            </div>

            {txn.checkoutUrl && !paid && !dead ? (
              <Button
                className="w-full"
                size="lg"
                onClick={() => window.open(txn.checkoutUrl!, "_blank", "noopener")}
              >
                <ExternalLink className="size-4" /> Pay with Paystack
              </Button>
            ) : null}

            {remainingMs !== null && !paid ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Timer className="size-4" />
                {expired
                  ? "This payment link has expired"
                  : `Link expires in ${formatCountdown(remainingMs)}`}
              </p>
            ) : null}

            {paid ? (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" /> Payment confirmed — thank you.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => receipt.mutate()}
                  disabled={receipt.isPending}
                >
                  <Download className="size-4" />
                  {receipt.isPending ? "Preparing…" : "Download receipt"}
                </Button>
              </div>
            ) : dead ? (
              <p className="text-sm text-destructive">
                {failureReason
                  ? `Payment ${status.toLowerCase()}: ${failureReason}`
                  : status === "Cancelled"
                    ? "This payment was cancelled — start a new one from the levy or fine list."
                    : status === "Refunded"
                      ? "This payment was refunded. Contact the ministry if this is unexpected."
                      : "Payment failed. Close this dialog and try again."}
              </p>
            ) : txn.checkoutUrl ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Complete the payment on the Paystack page that opened — card, bank transfer or USSD.
                This dialog updates automatically once confirmed.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Online payment is temporarily unavailable. Visit the ministry with reference{" "}
                <span className="font-mono">{txn.reference}</span> to pay manually, or try again
                later.
              </p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
