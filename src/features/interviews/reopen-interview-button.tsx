"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reopenInterviewAction } from "@/app/(dashboard)/interviews/actions";

export function ReopenInterviewButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onReopen = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await reopenInterviewAction(interviewId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={busy}>
        Reopen Interview
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Reopen interview?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Are you sure you want to reopen this interview? Existing reports may become outdated.
              </div>
              {error ? <div className="text-sm text-destructive">{error}</div> : null}
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button type="button" onClick={onReopen} disabled={busy}>
                  {busy ? "Reopening..." : "Reopen Interview"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}

