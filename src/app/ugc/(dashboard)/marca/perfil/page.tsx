import { createClient } from "@/lib/supabase/server";
import BrandProfileEditForm from "@/components/ugc/marca/BrandProfileEditForm";
import ChecklistVerificacion from "@/components/ugc/ChecklistVerificacion";
import { pasosVerificacionMarca } from "@/lib/ugc/verificacion";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function MarcaPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La cuenta de campañas alimenta el último paso de la checklist: dejar una
  // lista como borrador es trabajo útil que se puede adelantar sin estar
  // verificado, y de paso le muestra al equipo qué tipo de campaña va a correr.
  const [{ data: brandProfile }, { count: campaignCount }] = await Promise.all([
    supabase.from("brand_profiles").select("*").eq("profile_id", user!.id).single(),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", user!.id),
  ]);

  return (
    <div style={{ maxWidth: "920px" }}>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px" }}>
        Perfil del negocio
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "20px" }}>
        Así te ven los creadores dentro de UGC·CRC.
      </p>

      {brandProfile?.verified ? (
        <div
          className={`${styles.card} ${styles.cardPad}`}
          style={{
            marginBottom: "20px",
            background: "var(--ok-bg)",
            border: "1px solid var(--ok-line)",
          }}
        >
          <b style={{ color: "var(--ok)" }}>Negocio verificado.</b>
          <p style={{ marginTop: "4px", fontSize: "13.5px", color: "var(--ink-2)" }}>
            Los creadores ven el sello en tus promos.{" "}
            {brandProfile.slug && (
              <a
                href={`/ugc/marcas/${brandProfile.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--b-600)", fontWeight: 600 }}
              >
                Ver tu perfil público →
              </a>
            )}
          </p>
        </div>
      ) : (
        <div
          className={`${styles.card} ${styles.cardPad}`}
          style={{
            marginBottom: "20px",
            background: "var(--warn-bg)",
            border: "1px solid var(--warn-line)",
          }}
        >
          <b style={{ color: "var(--warn)" }}>Tu negocio está en revisión.</b>
          <p style={{ marginTop: "4px", fontSize: "13.5px", color: "var(--ink-2)" }}>
            Verificamos cada negocio antes de que publique, para que los creadores sepan con quién
            trabajan. Cuanto más completo esté este perfil, más rápido podemos revisarlo.
          </p>
          <ChecklistVerificacion pasos={pasosVerificacionMarca(brandProfile, campaignCount ?? 0)} />
        </div>
      )}

      <BrandProfileEditForm
        initial={{
          brand_name: brandProfile?.brand_name ?? "",
          industry: brandProfile?.industry ?? null,
          website: brandProfile?.website ?? null,
          instagram_handle: brandProfile?.instagram_handle ?? null,
          description: brandProfile?.description ?? null,
          location: brandProfile?.location ?? null,
          logo_url: brandProfile?.logo_url ?? null,
        }}
      />
    </div>
  );
}
