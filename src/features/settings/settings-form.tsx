"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updateSettingsAction, type SettingsFormValues } from "@/app/(dashboard)/settings/actions";

const settingsClientSchema = z.object({
  aiProvider: z.enum(["mock", "openai", "gemini", "claude"]),
  apiKey: z.union([z.string(), z.literal("")]).optional(),
  resumeParsingEnabled: z.boolean(),
  jdAnalysisEnabled: z.boolean(),
  maxResumeUploadMb: z.number().int().min(1).max(50),
});

export function SettingsForm({ initialValues }: { initialValues: SettingsFormValues }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  type FormValues = z.infer<typeof settingsClientSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(settingsClientSchema),
    defaultValues: initialValues,
  });

  const resumeParsingEnabled = useWatch({ control: form.control, name: "resumeParsingEnabled" });
  const jdAnalysisEnabled = useWatch({ control: form.control, name: "jdAnalysisEnabled" });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setNotice(null);
    const result = await updateSettingsAction(values as SettingsFormValues);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setNotice("Settings saved.");
    router.refresh();
  });

  const selectClassName = cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI configuration</CardTitle>
          <CardDescription>Provider-ready placeholders. Real providers will be wired later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aiProvider">AI provider</Label>
            <select id="aiProvider" className={selectClassName} {...form.register("aiProvider")}>
              <option value="mock">Mock (default)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="claude">Claude</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API key (placeholder)</Label>
            <Input id="apiKey" type="password" placeholder="Not required for mock provider" {...form.register("apiKey")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analysis engine</CardTitle>
          <CardDescription>Enable/disable parsing and configure upload limits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="resumeParsingEnabled"
              type="checkbox"
              className="h-4 w-4"
              checked={resumeParsingEnabled}
              onChange={(e) => form.setValue("resumeParsingEnabled", e.target.checked)}
            />
            <Label htmlFor="resumeParsingEnabled">Resume parsing enabled</Label>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="jdAnalysisEnabled"
              type="checkbox"
              className="h-4 w-4"
              checked={jdAnalysisEnabled}
              onChange={(e) => form.setValue("jdAnalysisEnabled", e.target.checked)}
            />
            <Label htmlFor="jdAnalysisEnabled">Job description analysis enabled</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxResumeUploadMb">Max resume upload size (MB)</Label>
            <Input
              id="maxResumeUploadMb"
              type="number"
              min={1}
              max={50}
              {...form.register("maxResumeUploadMb", { valueAsNumber: true })}
            />
            {form.formState.errors.maxResumeUploadMb?.message ? (
              <p className="text-sm text-destructive">{String(form.formState.errors.maxResumeUploadMb.message)}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

      <Button type="button" onClick={onSubmit} disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving..." : "Save settings"}
      </Button>
    </div>
  );
}
