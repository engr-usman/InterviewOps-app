"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { SettingsNavItem } from "@/features/settings/settings-nav-items";

export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 overflow-x-auto border-b">
      <nav className="flex min-w-max gap-1">
        {items.map((item) => {
          const isActive =
            item.href === "/settings"
              ? pathname === "/settings"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
