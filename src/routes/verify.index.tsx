import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/verify/")({ component: VerifyIndex });

function VerifyIndex() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) {
      toast.error("Enter a certificate number");
      return;
    }
    void navigate({ to: "/verify/$token", params: { token: v } });
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Verify a certificate</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Enter a certificate number (e.g. <code className="text-brand">OYS-LC-2026-000123</code>)
            or scan the QR code on the certificate.
          </p>
          <form onSubmit={submit} className="mt-5 flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Certificate number"
              className="font-mono"
            />
            <Button type="submit">
              <Search className="size-4" /> Verify
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
