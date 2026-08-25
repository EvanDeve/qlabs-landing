import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CampaignForm from "@/components/ugc/marca/CampaignForm";
import { QosIcon } from "@/lib/ugc/qos-icons";
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
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <Link href="/ugc/marca/ugc" className={styles.backBtn}>
        <QosIcon name="chevL" size={16} />
        Mis campañas
      </Link>

      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h1 className={styles.tbTitle} style={{ fontSize: "28px" }}>
          Nueva campaña
        </h1>
        <p style={{ marginTop: "8px", color: "var(--ink-2)" }}>
          Publicala para que los creadores la vean, o guardala como borrador y publicala más tarde.
        </p>
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <CampaignForm brandId={user!.id} />
      </div>
    </div>
  );
}
