import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { CandidateTable, type CandidateListRow } from "@/features/candidates/candidate-table";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const { q } = (await searchParams) ?? {};
  const query = q?.trim();

  let rows: CandidateListRow[] = [];
  let loadError: string | null = null;

  try {
    rows = await prisma.candidate.findMany({
      where: {
        createdById: session.user.id,
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
                { location: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        location: true,
        seniorityLevel: true,
        resumeFileName: true,
        resumeFileUrl: true,
        resumeUploadedAt: true,
        createdAt: true,
      },
    });
  } catch {
    loadError = "Failed to load candidates.";
  }

  return (
    <div>
      <PageHeader title="Candidates" description="Manage candidates and resumes for your interviews." />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form className="flex w-full max-w-md items-center gap-2" action="/candidates" method="get">
          <Input name="q" placeholder="Search by name, email, phone, or location…" defaultValue={query ?? ""} />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <Button asChild>
          <Link href="/candidates/new">Add Candidate</Link>
        </Button>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">No candidates yet</div>
              <div className="text-sm text-muted-foreground">
                Create your first candidate to start building interview sessions.
              </div>
              <div className="pt-2">
                <Button asChild>
                  <Link href="/candidates/new">Add Candidate</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <CandidateTable rows={rows} />
      )}
    </div>
  );
}
