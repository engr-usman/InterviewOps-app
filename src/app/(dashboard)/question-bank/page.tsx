import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function QuestionBankPage() {
  return (
    <div>
      <PageHeader title="Question bank" description="Maintain a reusable interview question library" />
      <Card>
        <CardHeader>
          <CardTitle>Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Question bank UI will live here.
        </CardContent>
      </Card>
    </div>
  );
}
