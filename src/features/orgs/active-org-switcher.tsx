"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Check, ChevronDown, LogOut, Plus, Settings, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveOrganizationAction } from "@/app/(onboarding)/onboarding/actions";
import type { OrgRole } from "@/server/services/rbac";
import type { PlanCode } from "@/server/services/feature-flags";
import { cn } from "@/lib/utils";

type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]).filter(Boolean);
  return (letters.join("") || name.slice(0, 2)).toUpperCase();
}

function planLabel(planCode: PlanCode): string {
  if (planCode === "ENTERPRISE") return "Enterprise";
  if (planCode === "TEAM") return "Team";
  if (planCode === "PRO") return "Pro";
  return "Free";
}

function planBadgeClass(planCode: PlanCode): string {
  if (planCode === "ENTERPRISE") {
    return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300";
  }
  if (planCode === "TEAM") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (planCode === "PRO") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

function OrgAvatar({ name, size }: { name: string; size: "sm" | "md" }) {
  const base = initialsFromName(name);
  const className =
    size === "md"
      ? "h-9 w-9 rounded-xl text-[12px]"
      : "h-8 w-8 rounded-lg text-[11px]";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex items-center justify-center bg-muted font-semibold text-muted-foreground ring-1 ring-border",
        className,
      )}
    >
      {base}
    </div>
  );
}

export function ActiveOrgSwitcher({
  activeOrganization,
  organizations,
  planCode,
  canManageTeam,
  canAccessOrganizationSettings,
  canCreateOrganization,
}: {
  activeOrganization: { id: string; name: string; slug: string; role: OrgRole };
  organizations: OrganizationOption[];
  planCode: PlanCode;
  canManageTeam: boolean;
  canAccessOrganizationSettings: boolean;
  canCreateOrganization: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  const onSwitch = (organizationId: string) => {
    startTransition(async () => {
      const result = await setActiveOrganizationAction({ organizationId });
      if (!result.ok) return;
      const query = searchParams?.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.replace(target);
      router.refresh();
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="default"
          disabled={pending}
          aria-label="Switch organization"
          className="h-11 gap-3 rounded-xl px-3 py-2 shadow-sm transition-colors hover:bg-accent/40 focus-visible:ring-2"
        >
          <OrgAvatar name={activeOrganization.name} size="md" />
          <div className="hidden min-w-0 flex-1 flex-col items-start sm:flex">
            <div className="w-full truncate text-sm font-semibold leading-tight text-foreground">
              {activeOrganization.name}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge variant="muted" className="px-2 py-0.5">
                {activeOrganization.role}
              </Badge>
              <span className="text-xs text-muted-foreground">•</span>
              <Badge variant="outline" className={cn("px-2 py-0.5", planBadgeClass(planCode))}>
                {planLabel(planCode)}
              </Badge>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              open ? "rotate-180" : "rotate-0",
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[360px] p-2">
        <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
        <div className="max-h-[280px] overflow-auto px-1 pb-1">
          {organizations.length === 0 ? (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">No organizations found.</div>
          ) : (
            organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                disabled={pending}
                onSelect={(e: Event) => {
                  e.preventDefault();
                  onSwitch(org.id);
                }}
                className={cn(
                  "mx-0.5 flex items-center justify-between gap-3 px-3 py-2.5",
                  org.id === activeOrganization.id ? "bg-accent text-accent-foreground" : "",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <OrgAvatar name={org.name} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{org.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{org.slug}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="px-2 py-0.5">
                    {org.role}
                  </Badge>
                  {org.id === activeOrganization.id ? <Check className="h-4 w-4 opacity-70" /> : null}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>

        <DropdownMenuSeparator />

        {canManageTeam ? (
          <DropdownMenuItem asChild disabled={pending}>
            <Link href="/settings/team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Management
            </Link>
          </DropdownMenuItem>
        ) : null}

        {canCreateOrganization ? (
          <DropdownMenuItem asChild disabled={pending}>
            <Link href="/settings/organizations" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Organization Management
            </Link>
          </DropdownMenuItem>
        ) : null}

        {canAccessOrganizationSettings ? (
          <DropdownMenuItem asChild disabled={pending}>
            <Link href="/settings/organization" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Organization Settings
            </Link>
          </DropdownMenuItem>
        ) : null}

        {canCreateOrganization ? (
          <DropdownMenuItem asChild disabled={pending}>
            <Link href="/onboarding?mode=create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create New Organization
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={pending}
          onSelect={(e: Event) => {
            e.preventDefault();
            void signOut({ callbackUrl: "/login" });
          }}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
