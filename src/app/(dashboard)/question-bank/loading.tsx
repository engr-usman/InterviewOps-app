import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function QuestionBankLoading() {
  return (
    <div>
      <PageHeader title="Question Bank" description="Maintain a reusable library of interview questions." />
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading questions…</CardContent>
      </Card>
    </div>
  );
}
