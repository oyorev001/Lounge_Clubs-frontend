import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { formatNaira } from "@/components/common/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { certificatesApi } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verify/$token")({ component: VerifyResult });

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function VerifyResult() {
  const { token } = Route.useParams();
  const { data, isPending, isError } = useQuery({
    queryKey: ["verify", token],
    queryFn: () => certificatesApi.verify(token),
    retry: false,
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  // A network/server failure is NOT the same as an invalid certificate —
  // show a "couldn't verify" state rather than implying forgery.
  if (isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Card className="border-t-4 border-t-amber-500">
          <CardHeader className="items-center text-center">
            <AlertTriangle className="size-14 text-amber-500" />
            <CardTitle className="font-display text-2xl">Couldn&apos;t verify</CardTitle>
            <CardDescription>
              The verification service didn&apos;t respond. Check your connection and try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/verify">Try again</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const found = data?.found ?? false;
  const valid = found && data?.isValid;

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Card className={cn("border-t-4", valid ? "border-t-success" : "border-t-destructive")}>
        <CardHeader className="items-center text-center">
          {valid ? (
            <CheckCircle2 className="size-14 text-success" />
          ) : (
            <XCircle className="size-14 text-destructive" />
          )}
          <CardTitle className="font-display text-2xl">
            {valid
              ? "Valid Certificate"
              : found
                ? "Certificate Not Valid"
                : "Certificate Not Found"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {valid
              ? "This certificate is authentic and currently valid."
              : found
                ? data?.status === "Active" &&
                  (data?.establishmentStatus === "Suspended" ||
                    data?.establishmentStatus === "Closed")
                  ? `The venue itself is ${data.establishmentStatus === "Suspended" ? "suspended" : "deregistered"} — the certificate cannot be relied on.`
                  : `Status: ${data?.status?.replace(/([a-z])([A-Z])/g, "$1 $2")} — this certificate is ${data?.status === "Expired" ? "past its validity date" : "no longer valid"}.`
                : "No certificate matches this number. It may be forged or mistyped."}
          </p>
        </CardHeader>
        {found ? (
          <CardContent>
            <Row
              label="Certificate No."
              value={<span className="font-mono">{data!.certificateNumber}</span>}
            />
            <Row label="Establishment" value={data!.establishmentName} />
            <Row label="Type" value={data!.establishmentType} />
            <Row label="LGA" value={data!.lga} />
            <Row label="Compliance Tier" value={data!.tierName} />
            <Row label="Levy Year" value={data!.levyYear} />
            <Row label="Issued" value={formatDate(data!.issueDate)} />
            <Row label="Valid Until" value={formatDate(data!.expiryDate)} />
          </CardContent>
        ) : null}
      </Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Verification provided by the Oyo State Lounge &amp; Clubs Compliance Portal. Report
        suspicious certificates to the Ministry of Culture &amp; Tourism.
      </p>
    </div>
  );
}
