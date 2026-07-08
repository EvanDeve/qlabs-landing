"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive =
          item.href === "/ugc/creador" || item.href === "/ugc/marca" || item.href === "/ugc/admin"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-pill px-4 py-2.5 text-sm font-bold transition ${
              isActive ? "bg-lavender text-violet-deep" : "text-ink-soft hover:bg-lavender/60 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
