import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function JobDescriptionsPage() {
  return (
    <div>
      <PageHeader title="Job descriptions" description="Store and manage job descriptions" />
      <Card>
        <CardHeader>
          <CardTitle>Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Job description management UI will live here.
        </CardContent>
      </Card>
    </div>
  );
}
