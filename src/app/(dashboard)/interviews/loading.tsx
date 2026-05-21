import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function InterviewsLoading() {
  return (
    <div>
      <PageHeader title="Interviews" description="Create and manage interview sessions." />
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading interviews…</CardContent>
      </Card>
    </div>
  );
}
