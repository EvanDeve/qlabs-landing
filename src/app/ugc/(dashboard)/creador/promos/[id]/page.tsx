import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PromoDetalle from "@/components/ugc/creador/PromoDetalle";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * El detalle con URL propia.
 *
 * Desde el feed, la promo abre en una hoja sin cambiar de página. Esta ruta
 * sigue existiendo para lo que llega de afuera —una notificación, un link
 * compartido, "abrir en pestaña nueva"— y muestra exactamente el mismo
 * contenido: es el mismo componente.
 */
export default async function PromoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Solo campañas publicadas: el brief completo no puede verse desde una
  // campaña en borrador aunque se adivine el id (RLS ya lo respalda).
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!campaign) {
    notFound();
  }

  const [{ data: brand }, { data: application }] = await Promise.all([
    supabase.from("brand_profiles").select("*").eq("profile_id", campaign.brand_id).maybeSingle(),
    supabase
      .from("applications")
      .select("status")
      .eq("campaign_id", campaign.id)
      .eq("creator_id", user!.id)
      .maybeSingle(),
  ]);

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      <Link href="/ugc/creador/promos" className={styles.backBtn}>
        <QosIcon name="chevL" size={16} />
        Volver al feed
      </Link>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <PromoDetalle
          promo={{
            id: campaign.id,
            title: campaign.title,
            brief: campaign.brief,
            budget_amount: campaign.budget_amount,
            compensation_details: campaign.compensation_details,
            deadline_days: campaign.deadline_days,
            target_audience: campaign.target_audience,
            deliverables: Array.isArray(campaign.deliverables)
              ? (campaign.deliverables as { type: string; qty: number }[])
              : [],
            usage_rights_scope: campaign.usage_rights_scope,
            usage_rights_duration: campaign.usage_rights_duration,
            usage_rights_editing: campaign.usage_rights_editing,
            usage_rights_notes: campaign.usage_rights_notes,
            brandName: brand?.brand_name ?? null,
            brandIndustry: brand?.industry ?? null,
            brandLocation: brand?.location ?? null,
            brandLogoUrl: brand?.logo_url ?? null,
            brandSlug: brand?.slug ?? null,
            brandVerified: brand?.verified ?? false,
            applicationStatus: application?.status ?? null,
          }}
        />
      </div>
    </div>
  );
}
