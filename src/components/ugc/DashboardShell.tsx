import Link from "next/link";
import DashboardNav from "@/components/ugc/DashboardNav";
import NotificationsBell from "@/components/ugc/NotificationsBell";
import SignOutButton from "@/components/ugc/SignOutButton";
import type { Database } from "@/lib/database.types";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export default function DashboardShell({
  navItems,
  notifications,
  children,
}: {
  navItems: { href: string; label: string }[];
  notifications: Notification[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col justify-between border-r border-line bg-white p-6">
        <div>
          <Link href="/ugc" className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
            UGC·CRC
          </Link>

          <div className="mt-10">
            <DashboardNav items={navItems} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
          <NotificationsBell notifications={notifications} />
          <SignOutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-10 py-16">{children}</main>
    </div>
  );
}
