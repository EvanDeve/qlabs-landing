import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CampaignForm from "@/components/ugc/marca/CampaignForm";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

// Ya no mira `verified`: al panel de la marca solo se entra verificado, así que
// acá siempre se puede publicar. El borrador sigue existiendo, pero como lo que
// siempre debió ser —"todavía no la quiero mostrar"— y no como el premio de
// consuelo de una cuenta a medio habilitar.
export default async function NuevaCampanaPage() {
  // El id viaja al formulario solo para separar su borrador del de otra cuenta
  // que use el mismo navegador. Ver la nota de BORRADOR_KEY.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className={styles.mcCol}>
      {/* "Cancelar" y no "Mis campañas": esto es un formulario, no una
          navegación, y el gesto que importa es abandonar sin publicar. */}
      <div className={styles.mcFormBar}>
        <Link href="/ugc/marca/ugc" className={styles.mcCancelar}>
          Cancelar
        </Link>
        <span className={styles.mcFormTitulo}>Nueva campaña</span>
      </div>

      <CampaignForm brandId={user!.id} />
    </div>
  );
}
