import { createClient } from "@/lib/supabase/server";
import UgcTabs from "@/components/ugc/marca/UgcTabs";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function MarcaUgcPanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "id, title, status, budget_amount, deliverables, deadline_days, published_at, created_at"
    )
    .eq("brand_id", user!.id)
    .order("created_at", { ascending: false });

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: applications } = campaignIds.length
    ? await supabase
        .from("applications")
        .select(
          "id, campaign_id, creator_id, status, pitch_message, rating, created_at, accepted_at, delivered_at, approved_at"
        )
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const apps = applications ?? [];

  // Todos los creadores que tocaron alguna campaña: los que esperan decisión y
  // los ya decididos, que la pestaña de aplicantes muestra abajo.
  const creatorIds = [...new Set(apps.map((a) => a.creator_id))];
  const [{ data: profiles }, { data: creatorProfiles }, { data: piezas }] = creatorIds.length
    ? await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url, city").in("id", creatorIds),
        supabase.from("creator_profiles").select("*").in("profile_id", creatorIds),
        // El conteo del book. Va en una sola consulta y se agrupa acá: pedir un
        // count por creador serían N viajes para una línea de texto.
        supabase.from("portfolio_items").select("creator_id").in("creator_id", creatorIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const creatorProfileById = new Map((creatorProfiles ?? []).map((c) => [c.profile_id, c]));

  const piezasPorCreador = new Map<string, number>();
  for (const it of piezas ?? []) {
    piezasPorCreador.set(it.creator_id, (piezasPorCreador.get(it.creator_id) ?? 0) + 1);
  }

  // La calificación promedio del creador sale de `creator_public_stats`, que es
  // una función pública: una marca NO puede leer las aplicaciones de otras
  // marcas, así que calcularlo a mano acá daría solo su propio historial.
  const stats = await Promise.all(
    creatorIds.map(async (id) => {
      const { data } = await supabase.rpc("creator_public_stats", { p_creator_id: id });
      const fila = Array.isArray(data) ? data[0] : null;
      return [id, fila ?? null] as const;
    })
  );
  const statsById = new Map(stats);

  const entregas = await supabase
    .from("application_deliveries")
    .select("application_id")
    .in(
      "application_id",
      apps.map((a) => a.id)
    );
  const entregasPorApp = new Map<string, number>();
  for (const d of entregas.data ?? []) {
    entregasPorApp.set(d.application_id, (entregasPorApp.get(d.application_id) ?? 0) + 1);
  }

  const brandProfile = await supabase
    .from("brand_profiles")
    .select("brand_name, description, location")
    .eq("profile_id", user!.id)
    .maybeSingle();

  const perfilIncompleto =
    !brandProfile.data?.description?.trim() || !brandProfile.data?.location?.trim();

  return (
    <div className={styles.mcCol}>
      <UgcTabs
        campaigns={campaigns ?? []}
        applications={apps}
        profiles={Object.fromEntries(profileById)}
        creatorProfiles={Object.fromEntries(creatorProfileById)}
        piezasPorCreador={Object.fromEntries(piezasPorCreador)}
        statsPorCreador={Object.fromEntries(statsById)}
        entregasPorApp={Object.fromEntries(entregasPorApp)}
        perfilIncompleto={perfilIncompleto}
      />
    </div>
  );
}
