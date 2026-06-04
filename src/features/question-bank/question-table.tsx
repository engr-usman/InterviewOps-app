"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DifficultyLevel, QuestionType, SeniorityLevel } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteQuestionAction } from "@/app/(dashboard)/question-bank/actions";

export type QuestionListRow = {
  id: string;
  domain: string | null;
  subDomain: string | null;
  topic: string;
  prompt: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  seniorityLevel: SeniorityLevel | null;
  visibility: "PRIVATE" | "ORGANIZATION";
  createdById: string;
  createdBy: { name: string | null; email: string };
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

export function QuestionTable({
  rows,
  canManage,
  canManageOwn,
  currentUserId,
}: {
  rows: QuestionListRow[];
  canManage: boolean;
  canManageOwn: boolean;
  currentUserId: string;
}) {
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
              <TableHead>Domain</TableHead>
              <TableHead>Sub-domain</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Seniority</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {(() => {
                  const isMine = row.createdById === currentUserId;
                  const createdByLabel = isMine ? "You" : row.createdBy.name ?? row.createdBy.email;
                  const visibilityLabel = row.visibility === "PRIVATE" ? "Private" : "Shared";
                  const scopeLabel =
                    row.visibility === "ORGANIZATION"
                      ? "Shared Question"
                      : isMine
                        ? "My Question"
                        : "Private Question";

                  return (
                    <>
                <TableCell className="text-muted-foreground">{row.domain ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.subDomain ?? "—"}</TableCell>
                <TableCell className="font-medium">{row.topic}</TableCell>
                <TableCell className="text-muted-foreground">{preview(row.prompt)}</TableCell>
                <TableCell className="text-muted-foreground">{row.difficulty}</TableCell>
                <TableCell className="text-muted-foreground">{row.seniorityLevel ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{visibilityLabel}</TableCell>
                <TableCell className="text-muted-foreground">{createdByLabel}</TableCell>
                <TableCell>
                  <Badge variant="outline">{scopeLabel}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/question-bank/${row.id}`}>View</Link>
                    </Button>
                    {(() => {
                      const canEditThis =
                        canManage || (canManageOwn && row.visibility === "PRIVATE" && row.createdById === currentUserId);
                      if (!canEditThis) return null;
                      return (
                        <>
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
                        </>
                      );
                    })()}
                  </div>
                </TableCell>
                    </>
                  );
                })()}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
