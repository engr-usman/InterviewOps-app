"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { hasPermission, type OrgRole } from "@/server/services/rbac";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/candidates", label: "Candidates" },
  { href: "/job-descriptions", label: "Job descriptions" },
  { href: "/interviews", label: "Interviews" },
  { href: "/question-bank", label: "Question bank" },
  { href: "/reports", label: "Reports" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar({ role }: { role: OrgRole }) {
  const pathname = usePathname();
  const showSettings =
    hasPermission(role, "settings:manage") ||
    hasPermission(role, "billing:manage") ||
    hasPermission(role, "team:manage") ||
    hasPermission(role, "org:manage");
  const effectiveItems = showSettings ? navItems : navItems.filter((i) => i.href !== "/settings");

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background p-4">
      <div className="mb-6 text-lg font-semibold">InterviewOps</div>
      <nav className="flex flex-col gap-1">
        {effectiveItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
