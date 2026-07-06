import { requireRole } from "@/lib/auth/require-role";

export default async function CreadorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("creator");
  return <>{children}</>;
}
