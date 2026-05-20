"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeniorityLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteCandidateAction } from "@/app/(dashboard)/candidates/actions";

export type CandidateListRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  seniorityLevel: SeniorityLevel | null;
  resumeFileName: string | null;
  resumeFileUrl: string | null;
  resumeUploadedAt: Date | null;
  createdAt: Date;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(
    value,
  );
}

function resumeStatus(row: CandidateListRow) {
  if (row.resumeFileUrl || row.resumeFileName || row.resumeUploadedAt) return "Uploaded";
  return "Not uploaded";
}

export function CandidateTable({ rows }: { rows: CandidateListRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onDelete = async (id: string) => {
    const ok = window.confirm("Delete this candidate? This cannot be undone.");
    if (!ok) return;

    setError(null);
    setDeletingId(id);
    try {
      const result = await deleteCandidateAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Seniority</TableHead>
              <TableHead>Resume</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{row.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.phone ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.location ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.seniorityLevel ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{resumeStatus(row)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/candidates/${row.id}`}>View</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/candidates/${row.id}/edit`}>Edit</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deletingId === row.id}
                      onClick={() => onDelete(row.id)}
                    >
                      {deletingId === row.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
