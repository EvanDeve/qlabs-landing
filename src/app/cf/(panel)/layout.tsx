import { requireMember } from "@/lib/cf/sesion";

export const dynamic = "force-dynamic";

/** Todo lo de adentro de /cf: solo miembros. La puerta es `requireMember`. */
export default async function PanelCfLayout({ children }: { children: React.ReactNode }) {
  await requireMember();
  return children;
}
