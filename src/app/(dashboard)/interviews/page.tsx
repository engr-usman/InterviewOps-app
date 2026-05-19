import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InterviewsPage() {
  return (
    <div>
      <PageHeader title="Interviews" description="Create and manage interview sessions" />
      <Card>
        <CardHeader>
          <CardTitle>Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Interview sessions UI will live here.
        </CardContent>
      </Card>
    </div>
  );
}
