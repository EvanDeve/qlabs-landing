import { requireRole } from "@/lib/auth/require-role";

export default async function MarcaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("brand");
  return <>{children}</>;
}
