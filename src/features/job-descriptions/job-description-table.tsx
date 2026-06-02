"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SeniorityLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteJobDescriptionAction } from "@/app/(dashboard)/job-descriptions/actions";

export type JobDescriptionListRow = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  seniorityLevel: SeniorityLevel | null;
  createdAt: Date;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(
    value,
  );
}

export function JobDescriptionTable({ rows, canManage }: { rows: JobDescriptionListRow[]; canManage: boolean }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onDelete = async (id: string) => {
    const ok = window.confirm("Delete this job description? This cannot be undone.");
    if (!ok) return;

    setError(null);
    setDeletingId(id);
    try {
      const result = await deleteJobDescriptionAction(id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError("You do not have permission to perform this action.");
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
              <TableHead>Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Seniority</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.title}</TableCell>
                <TableCell className="text-muted-foreground">{row.department ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.location ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.seniorityLevel ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/job-descriptions/${row.id}`}>View</Link>
                    </Button>
                    {canManage ? (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/job-descriptions/${row.id}/edit`}>Edit</Link>
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
                      </>
                    ) : null}
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
