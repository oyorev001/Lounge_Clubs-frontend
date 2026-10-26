import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileBadge } from "lucide-react";
import { toast } from "sonner";

import { QueryError, RouteEmpty } from "@/components/common/route-states";
import { CertificateStatusBadge, formatNaira } from "@/components/common/status-badges";
import { SectionCard } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { certificatesApi, queryKeys, saveBlobAs } from "@/services";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import type { Certificate } from "@/services";

export const Route = createFileRoute("/dashboard/certificates/")({ component: CertificatesPage });

function CertificateCard({ cert }: { cert: Certificate }) {
  const download = useMutation({
    mutationFn: () => certificatesApi.pdf(cert.id),
    onSuccess: (res) => saveBlobAs(res),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not download certificate"),
  });

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-tint-soft)] text-[var(--brand)]">
              <FileBadge className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold">{cert.certificateNumber}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{cert.establishmentName}</p>
            </div>
          </div>
          <CertificateStatusBadge status={cert.status} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Tier</dt>
            <dd className="font-medium">{cert.tierName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Levy year</dt>
            <dd className="font-medium">{cert.levyYear}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Issued</dt>
            <dd className="font-medium">{fmtDate(cert.issueDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Expires</dt>
            <dd className="font-medium">{fmtDate(cert.expiryDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Amount paid</dt>
            <dd className="font-medium">{formatNaira(cert.amountPaid)}</dd>
          </div>
        </dl>

        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          disabled={download.isPending}
          onClick={() => download.mutate()}
        >
          <Download className="size-4" />
          {download.isPending ? "Preparing…" : "Download PDF"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CertificatesPage() {
  const certs = useQuery({
    queryKey: queryKeys.certificates.mine(),
    queryFn: certificatesApi.mine,
  });

  return (
    <div className="px-4 py-6 sm:px-8">
      <SectionCard
        title="Certificates"
        description="Compliance certificates issued for paid levies"
      >
        {certs.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : certs.isError ? (
          <QueryError error={certs.error} onRetry={() => void certs.refetch()} />
        ) : certs.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {certs.data.map((c) => (
              <CertificateCard key={c.id} cert={c} />
            ))}
          </div>
        ) : (
          <RouteEmpty
            title="No certificates"
            hint="Certificates are issued automatically when a levy payment is confirmed."
          />
        )}
      </SectionCard>
    </div>
  );
}
