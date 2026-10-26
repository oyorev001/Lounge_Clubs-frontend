import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect } from "react";

import { SiteFooter, SiteHeader } from "@/components/layout/site-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth-guard";
import { paymentsApi } from "@/services";

export const Route = createFileRoute("/payment-callback")({
  // The status endpoint is authenticated — land logged-out users on /login
  // first, preserving the Paystack reference through the redirect.
  beforeLoad: ({ context, location }) => {
    requireSession(context.queryClient, location.href);
  },
  validateSearch: (s: Record<string, unknown>) => ({
    reference: (s["reference"] as string) || (s["trxref"] as string) || undefined,
  }),
  component: PaymentCallbackPage,
});

function PaymentCallbackPage() {
  const { reference } = Route.useSearch();
  const queryClient = useQueryClient();

  // Hitting the status endpoint triggers server-side Paystack verification —
  // this settles the payment even if the webhook never arrived.
  const { data, isPending, isError } = useQuery({
    queryKey: ["payments", "status", reference],
    queryFn: () => paymentsApi.status(reference!),
    enabled: Boolean(reference),
    retry: 2,
    // Keep polling while the payment is still settling — an awaiting
    // confirmation is not a terminal state.
    refetchInterval: (q) =>
      q.state.data?.status === "Pending" || q.state.data?.status === "AwaitingConfirmation"
        ? 10_000
        : false,
  });

  // Once settled, force the owner's lists to refetch — the payment just
  // changed levies/fines/certificates so cached data is stale.
  useEffect(() => {
    if (data?.status === "Successful") {
      queryClient.invalidateQueries({ queryKey: ["levies"] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [data?.status, queryClient]);

  const status = data?.status;
  const paid = status === "Successful";
  const failed = status === "Failed" || status === "Cancelled" || status === "Refunded" || isError;

  if (!reference) {
    return (
      <>
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 py-16">
          <Card>
            <CardHeader className="items-center text-center">
              <XCircle className="size-12 text-destructive" />
              <CardTitle>No payment reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                This link is missing the payment reference. If you just paid, check your dashboard —
                the payment is confirmed automatically.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader className="items-center text-center">
            {isPending || (!paid && !failed) ? (
              <Loader2 className="size-12 animate-spin text-brand" />
            ) : paid ? (
              <CheckCircle2 className="size-12 text-success" />
            ) : (
              <XCircle className="size-12 text-destructive" />
            )}
            <CardTitle>
              {isPending || (!paid && !failed)
                ? "Confirming your payment…"
                : paid
                  ? "Payment confirmed"
                  : "Payment could not be confirmed"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {reference ? (
              <p className="font-mono text-xs text-muted-foreground">{reference}</p>
            ) : null}
            {paid ? (
              <p className="text-sm text-muted-foreground">
                {data?.certificateNumber
                  ? `Your compliance certificate ${data.certificateNumber} has been issued.`
                  : "Your payment was received and recorded."}
              </p>
            ) : !isPending && !failed ? (
              <p className="text-sm text-muted-foreground">
                Your payment is still processing. If you already paid, it will be confirmed shortly
                — check your dashboard.
              </p>
            ) : null}
            <div className="flex justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
              {paid && data?.certificateId ? (
                <Button asChild size="sm">
                  <Link to="/dashboard/certificates">View certificate</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </>
  );
}
