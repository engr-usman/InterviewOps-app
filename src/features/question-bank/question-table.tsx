"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DifficultyLevel, QuestionType, SeniorityLevel } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteQuestionAction } from "@/app/(dashboard)/question-bank/actions";

export type QuestionListRow = {
  id: string;
  topic: string;
  prompt: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  seniorityLevel: SeniorityLevel | null;
  createdAt: Date;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(
    value,
  );
}

function preview(text: string, max = 90) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function QuestionTable({ rows }: { rows: QuestionListRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onDelete = async (id: string) => {
    const ok = window.confirm("Delete this question? This cannot be undone.");
    if (!ok) return;

    setError(null);
    setDeletingId(id);
    try {
      const result = await deleteQuestionAction(id);
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
              <TableHead>Topic</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Seniority</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.topic}</TableCell>
                <TableCell className="text-muted-foreground">{preview(row.prompt)}</TableCell>
                <TableCell className="text-muted-foreground">{row.type}</TableCell>
                <TableCell className="text-muted-foreground">{row.difficulty}</TableCell>
                <TableCell className="text-muted-foreground">{row.seniorityLevel ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/question-bank/${row.id}`}>View</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/question-bank/${row.id}/edit`}>Edit</Link>
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
