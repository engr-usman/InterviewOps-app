"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeInterviewQuestionAction } from "@/app/(dashboard)/interviews/question-actions";

export type InterviewQuestionRow = {
  id: string;
  order: number;
  topic: string;
  questionText: string;
  type: string;
  difficulty: string;
};

function preview(text: string, max = 90) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function InterviewQuestionTable({
  interviewId,
  rows,
}: {
  interviewId: string;
  rows: InterviewQuestionRow[];
}) {
  const router = useRouter();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onRemove = async (id: string) => {
    const ok = window.confirm("Remove this question from the interview?");
    if (!ok) return;

    setError(null);
    setRemovingId(id);
    try {
      const result = await removeInterviewQuestionAction(interviewId, id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">Order</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">{row.order}</TableCell>
                <TableCell className="font-medium">{row.topic}</TableCell>
                <TableCell className="text-muted-foreground">{preview(row.questionText)}</TableCell>
                <TableCell className="text-muted-foreground">{row.type}</TableCell>
                <TableCell className="text-muted-foreground">{row.difficulty}</TableCell>
                <TableCell className="text-muted-foreground">Pending</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/interviews/${interviewId}/questions/${row.id}`}>View</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={removingId === row.id}
                      onClick={() => onRemove(row.id)}
                    >
                      {removingId === row.id ? "Removing..." : "Remove"}
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

