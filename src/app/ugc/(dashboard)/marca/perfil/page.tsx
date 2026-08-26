import { createClient } from "@/lib/supabase/server";
import NegocioEditor from "@/components/ugc/marca/NegocioEditor";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function MarcaPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: brand }, { data: profile }] = await Promise.all([
    supabase.from("brand_profiles").select("*").eq("profile_id", user!.id).single(),
    supabase.from("profiles").select("display_name").eq("id", user!.id).single(),
  ]);

  return (
    <div className={styles.mcCol}>
      <NegocioEditor
        inicial={{
          brand_name: brand?.brand_name ?? "",
          industry: brand?.industry ?? null,
          location: brand?.location ?? null,
          description: brand?.description ?? null,
          website: brand?.website ?? null,
          instagram_handle: brand?.instagram_handle ?? null,
          logo_url: brand?.logo_url ?? null,
          verified: brand?.verified ?? false,
          slug: brand?.slug ?? null,
          admin_nombre: profile?.display_name ?? "Sin nombre",
        }}
      />
    </div>
  );
}
