import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function JobDescriptionsLoading() {
  return (
    <div>
      <PageHeader title="Job Descriptions" description="Create and manage job descriptions for interviews." />
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading job descriptions…</CardContent>
      </Card>
    </div>
  );
}
