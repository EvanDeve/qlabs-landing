import { requireMember } from "@/lib/cf/sesion";
import { cuponesDelMiembro } from "@/lib/cf/cupones";
import PantallaHeader from "@/components/ugc/PantallaHeader";
import CuponesMiembroTabs from "@/components/cf/CuponesMiembroTabs";
import RefrescoVivo from "@/components/cf/RefrescoVivo";

export default async function CuponesCfPage() {
  const { supabase } = await requireMember();
  const { disponibles, mios } = await cuponesDelMiembro(supabase);

  return (
    <>
      {/* En caja: el negocio valida y el cupón pasa a "canjeado" sin recargar. */}
      {mios.some((m) => m.estado === "por_usar") && <RefrescoVivo />}
      <PantallaHeader
        titulo="Cupones"
        descripcion="Mostrá el QR en caja. Cada cupón se usa una vez."
      />
      <CuponesMiembroTabs disponibles={disponibles} mios={mios} />
    </>
  );
}
