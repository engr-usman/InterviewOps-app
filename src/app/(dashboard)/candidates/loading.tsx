import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function CandidatesLoading() {
  return (
    <div>
      <PageHeader title="Candidates" description="Manage candidates and resumes for your interviews." />
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading candidates…</CardContent>
      </Card>
    </div>
  );
}
