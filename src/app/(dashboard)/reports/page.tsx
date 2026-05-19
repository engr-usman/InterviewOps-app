import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Scorecards, feedback, and reports" />
      <Card>
        <CardHeader>
          <CardTitle>Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Reports UI will live here.
        </CardContent>
      </Card>
    </div>
  );
}
