"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInviteCreateAccountAction } from "@/app/invite/actions";

const acceptSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required."),
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });

type AcceptValues = z.infer<typeof acceptSchema>;

export function InviteAcceptForm({
  token,
  organizationName,
  invitedEmail,
  invitedRole,
  expiresAt,
  loginUrl,
}: {
  token: string;
  organizationName: string;
  invitedEmail: string;
  invitedRole: string;
  expiresAt: string;
  loginUrl: string;
}) {
  const router = useRouter();
  const form = useForm<AcceptValues>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      fullName: "",
      email: invitedEmail,
      password: "",
      confirmPassword: "",
    },
  });

  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [requiresSignIn, setRequiresSignIn] = React.useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setNotice(null);
    setRequiresSignIn(false);

    const result = await acceptInviteCreateAccountAction({
      token,
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });

    if (!result.ok) {
      if (result.code === "EMAIL_EXISTS") setRequiresSignIn(true);
      setError(result.error);
      return;
    }

    const signInResult = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (!signInResult || signInResult.error) {
      setError("Account created, but sign-in failed. Please sign in to continue.");
      setRequiresSignIn(true);
      return;
    }

    setNotice("Account created. Redirecting...");
    router.push("/dashboard");
    router.refresh();
  });

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Join {organizationName}</CardTitle>
        <CardDescription>You have been invited as {invitedRole}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4 text-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <div className="text-muted-foreground">Invited email</div>
              <div className="mt-1 font-medium">{invitedEmail}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Role</div>
              <div className="mt-1 font-medium">{invitedRole}</div>
            </div>
            <div className="sm:col-span-3">
              <div className="text-muted-foreground">Expires</div>
              <div className="mt-1 font-medium">{expiresAt}</div>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
              {form.formState.errors.fullName ? (
                <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" readOnly {...form.register("email")} />
              {form.formState.errors.email ? <p className="text-sm text-destructive">{form.formState.errors.email.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
              {form.formState.errors.password ? (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword ? (
                <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create account and join organization"}
            </Button>
            {requiresSignIn ? (
              <Button type="button" variant="outline" onClick={() => router.push(loginUrl)}>
                Sign in and accept invite
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
