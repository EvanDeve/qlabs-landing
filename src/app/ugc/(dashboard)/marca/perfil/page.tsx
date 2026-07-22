import { createClient } from "@/lib/supabase/server";
import BrandProfileEditForm from "@/components/ugc/marca/BrandProfileEditForm";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

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
    <div style={{ maxWidth: "560px" }}>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px" }}>
        Perfil del negocio
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "20px" }}>
        Así te ven los creadores dentro de UGC·CRC.
      </p>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <BrandProfileEditForm
          initial={{
            brand_name: brandProfile?.brand_name ?? "",
            industry: brandProfile?.industry ?? null,
            website: brandProfile?.website ?? null,
            instagram_handle: brandProfile?.instagram_handle ?? null,
            description: brandProfile?.description ?? null,
          }}
        />
      </div>
    </div>
  );
}
