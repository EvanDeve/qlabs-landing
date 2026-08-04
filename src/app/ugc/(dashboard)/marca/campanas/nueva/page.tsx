import Link from "next/link";
import CampaignForm from "@/components/ugc/marca/CampaignForm";
import { createClient } from "@/lib/supabase/server";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function NuevaCampanaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El formulario necesita saberlo para no ofrecer "Publicar" como acción
  // principal a un negocio que todavía no puede publicar.
  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("verified")
    .eq("profile_id", user!.id)
    .maybeSingle();

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
          {brandProfile?.verified
            ? "Publicala para que los creadores la vean, o guardala como borrador y publicala más tarde."
            : "Dejala lista como borrador: la publicás de un clic apenas verifiquemos tu negocio."}
        </p>
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <CampaignForm verified={brandProfile?.verified ?? false} />
      </div>
    </div>
  );
}
