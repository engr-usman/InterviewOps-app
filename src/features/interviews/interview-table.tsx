"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InterviewStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteInterviewAction } from "@/app/(dashboard)/interviews/actions";

export type InterviewListRow = {
  id: string;
  status: InterviewStatus;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  createdAt: Date;
  candidate: { id: string; fullName: string };
  jobDescription: { id: string; title: string };
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function InterviewTable({ rows, canManage }: { rows: InterviewListRow[]; canManage: boolean }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onDelete = async (id: string) => {
    const ok = window.confirm("Delete this interview? This cannot be undone.");
    if (!ok) return;

    setError(null);
    setDeletingId(id);
    try {
      const result = await deleteInterviewAction(id);
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
              <TableHead>Candidate</TableHead>
              <TableHead>Job description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scheduled start</TableHead>
              <TableHead>Scheduled end</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.candidate.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{row.jobDescription.title}</TableCell>
                <TableCell className="text-muted-foreground">{row.status}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.scheduledStartAt ? formatDateTime(row.scheduledStartAt) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.scheduledEndAt ? formatDateTime(row.scheduledEndAt) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(row.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/interviews/${row.id}`}>View</Link>
                    </Button>
                    {canManage ? (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/interviews/${row.id}/edit`}>Edit</Link>
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
