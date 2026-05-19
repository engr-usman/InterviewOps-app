import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CandidatesPage() {
  return (
    <div>
      <PageHeader title="Candidates" description="Manage candidates and resume uploads" />
      <Card>
        <CardHeader>
          <CardTitle>Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Candidate management UI will live here.
        </CardContent>
      </Card>
    </div>
  );
}
