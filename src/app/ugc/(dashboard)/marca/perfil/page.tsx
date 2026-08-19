import { createClient } from "@/lib/supabase/server";
import BrandProfileEditForm from "@/components/ugc/marca/BrandProfileEditForm";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function MarcaPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("profile_id", user!.id)
    .single();

  return (
    <div style={{ maxWidth: "920px" }}>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px" }}>
        Perfil del negocio
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "20px" }}>
        Así te ven los creadores dentro de UGC·CRC.
      </p>

      {/* Ya no hay variante "en revisión": al panel solo se entra verificado.
          Queda el sello, que sigue diciendo algo útil — dónde lo ven los
          creadores y cómo se ve el perfil del otro lado. */}
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
          {brandProfile?.slug && (
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
