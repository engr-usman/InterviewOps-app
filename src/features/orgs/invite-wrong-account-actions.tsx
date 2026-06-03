"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function InviteWrongAccountActions({ inviteUrl }: { inviteUrl: string }) {
  return (
    <Button
      type="button"
      onClick={() => {
        void signOut({ callbackUrl: inviteUrl });
      }}
    >
      Sign out and continue with invited email
    </Button>
  );
}
