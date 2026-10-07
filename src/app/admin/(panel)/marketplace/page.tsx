import { requireArea } from "@/lib/auth/areas";
import { markCampaignCompletedAction } from "@/lib/actions/admin";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import VerificacionAcciones from "@/components/ugc/admin/VerificacionAcciones";
import { estadoCuenta, type EstadoCuenta } from "@/lib/ugc/estado-cuenta";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_STYLE } from "@/lib/ugc/campaign-status";
import { fechaCorta } from "@/lib/ugc/loyalty";
import {
  PESTANAS_MARKETPLACE,
  coincide,
  leerEstado,
  leerPestana,
  type PestanaMarketplace,
} from "@/lib/ugc/marketplace-admin";
import { FiltroAdmin, PestanasAdmin, TarjetaLista } from "@/components/ugc/admin/PestanasAdmin";
import type { ApplicationStatus, CampaignStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";
import { displayHandle, handleSlug } from "@/lib/ugc/handles";

export const dynamic = "force-dynamic";

/** Tope de aplicaciones por pantalla. Antes eran las últimas 20 y nada más. */
const MAX_APLICACIONES = 200;

const ESTADOS_CUENTA: EstadoCuenta[] = ["pendiente", "verificada", "rechazada"];
const ESTADOS_CAMPANA = Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[];
const ESTADOS_APLICACION = Object.keys(APPLICATION_STATUS_LABEL) as ApplicationStatus[];

function labelEstadoCuenta(estado: EstadoCuenta, femenino: boolean): string {
  if (estado === "pendiente") return "Pendiente";
  const base = estado === "verificada" ? "Verificad" : "Rechazad";
  return base + (femenino ? "a" : "o");
}

// Los tres estados se pintan siempre, también "Pendiente": antes solo se
// marcaba lo verificado y una fila sin sello podía ser tanto "todavía nadie la
// miró" como "la miramos y la rechazamos".
function EstadoPill({ estado, femenino }: { estado: EstadoCuenta; femenino: boolean }) {
  const clase =
    estado === "verificada" ? styles.riskOk : estado === "rechazada" ? styles.riskRisk : styles.riskWarn;
  return <span className={`${styles.riskPill} ${clase}`}>{labelEstadoCuenta(estado, femenino)}</span>;
}

function Pill({ label, estilo }: { label: string; estilo: "Ok" | "Warn" | "Risk" | "Muted" }) {
  return <span className={`${styles.riskPill} ${styles[`risk${estilo}`]}`}>{label}</span>;
}

type Busqueda = { tab?: string; q?: string; estado?: string };

/**
 * El marketplace desde adentro, en cuatro pestañas. Cada pestaña trae solo sus
 * filas; los números de las pestañas salen de `count` sin traer ninguna, que el
 * egress de Supabase es la primera pared con la que vamos a chocar.
 *
 * Buscador y estado viajan por GET: la URL dice qué se está mirando, sirve para
 * pasarla, y una acción (verificar, completar) vuelve a la misma vista.
 */
export default async function AdminMarketplacePage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  // Área UGC: directores y el rol ugc. La RLS igual no le devolvería las
  // filas a nadie más, pero rebotar es mejor que una página vacía.
  const { supabase } = await requireArea("ugc");
  const params = await searchParams;
  const tab = leerPestana(params.tab);
  const q = (params.q ?? "").trim();

  const contar = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);
  const [creadores, creadoresPendientes, marcas, marcasPendientes, campanas, aplicaciones] =
    await Promise.all([
      contar(supabase.from("creator_profiles").select("profile_id", { count: "exact", head: true })),
      contar(
        supabase
          .from("creator_profiles")
          .select("profile_id", { count: "exact", head: true })
          .eq("verified", false)
          .is("rejected_at", null),
      ),
      contar(supabase.from("brand_profiles").select("profile_id", { count: "exact", head: true })),
      contar(
        supabase
          .from("brand_profiles")
          .select("profile_id", { count: "exact", head: true })
          .eq("verified", false)
          .is("rejected_at", null),
      ),
      contar(supabase.from("campaigns").select("id", { count: "exact", head: true })),
      contar(supabase.from("applications").select("id", { count: "exact", head: true })),
    ]);

  const totales: Record<PestanaMarketplace, number> = {
    creadores,
    marcas,
    campanas,
    aplicaciones,
  };
  const pendientes: Partial<Record<PestanaMarketplace, number>> = {
    creadores: creadoresPendientes,
    marcas: marcasPendientes,
  };

  const opcionesEstado: { id: string; label: string }[] =
    tab === "creadores" || tab === "marcas"
      ? ESTADOS_CUENTA.map((e) => ({
          id: e,
          label: labelEstadoCuenta(e, tab === "marcas"),
        }))
      : tab === "campanas"
        ? ESTADOS_CAMPANA.map((e) => ({
            id: e,
            label: CAMPAIGN_STATUS_LABEL[e],
          }))
        : ESTADOS_APLICACION.map((e) => ({
            id: e,
            label: APPLICATION_STATUS_LABEL[e],
          }));
  const estado = leerEstado(
    params.estado,
    opcionesEstado.map((o) => o.id),
  );

  const placeholder: Record<PestanaMarketplace, string> = {
    creadores: "Handle, nombre o ciudad",
    marcas: "Nombre, rubro o ubicación",
    campanas: "Título o marca",
    aplicaciones: "Creador, campaña o marca",
  };

  const lista =
    tab === "creadores" ? (
      <ListaCreadores supabase={supabase} q={q} estado={estado as EstadoCuenta | null} />
    ) : tab === "marcas" ? (
      <ListaMarcas supabase={supabase} q={q} estado={estado as EstadoCuenta | null} />
    ) : tab === "campanas" ? (
      <ListaCampanas supabase={supabase} q={q} estado={estado as CampaignStatus | null} />
    ) : (
      <ListaAplicaciones
        supabase={supabase}
        q={q}
        estado={estado as ApplicationStatus | null}
        totalGeneral={aplicaciones}
      />
    );

  return (
    <div>
      <PestanasAdmin
        base="/admin/marketplace"
        label="Secciones del marketplace"
        activa={tab}
        pestanas={PESTANAS_MARKETPLACE.map((p) => ({
          id: p.id,
          label: p.label,
          count: totales[p.id],
          aviso: { n: pendientes[p.id] ?? 0, texto: "por verificar" },
        }))}
      />
      <FiltroAdmin
        base="/admin/marketplace"
        tab={tab}
        q={q}
        placeholder={placeholder[tab]}
        estado={estado}
        opciones={opcionesEstado}
      />
      {lista}
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof requireArea>>["supabase"];

async function ListaCreadores({
  supabase,
  q,
  estado,
}: {
  supabase: Supabase;
  q: string;
  estado: EstadoCuenta | null;
}) {
  const { data: creatorProfiles } = await supabase
    .from("creator_profiles")
    .select("*")
    .order("verified", { ascending: true })
    .order("followers_count", { ascending: false });
  const todos = creatorProfiles ?? [];

  const ids = todos.map((c) => c.profile_id);
  const { data: cuentas } = ids.length
    ? await supabase.from("profiles").select("id, display_name, city").in("id", ids)
    : { data: [] };
  const cuentaPorId = new Map((cuentas ?? []).map((p) => [p.id, p]));

  const filtrados = todos.filter((c) => {
    const cuenta = cuentaPorId.get(c.profile_id);
    return (
      (!estado || estadoCuenta(c) === estado) &&
      coincide(q, [c.handle, c.instagram_handle, c.tiktok_handle, cuenta?.display_name, cuenta?.city])
    );
  });

  return (
    <TarjetaLista
      titulo="Creadores"
      mostrados={filtrados.length}
      total={todos.length}
      vacio="Todavía no hay creadores."
    >
      {filtrados.map((creator) => {
        const account = cuentaPorId.get(creator.profile_id);
        // El handle es lo que arma la URL del media-kit. Puede venir vacío o
        // solo con "@" en filas viejas, y ahí el link caería en un 404.
        const slug = handleSlug(creator.handle);
        const est = estadoCuenta(creator);
        return (
          <div
            key={creator.profile_id}
            className={`${styles.attnItem} ${styles.mktFila}`}
            style={{ cursor: "default" }}
          >
            <div className={styles.attnBody}>
              <div className={styles.attnTitle}>
                {displayHandle(creator.handle)} <EstadoPill estado={est} femenino={false} />
              </div>
              <div className={styles.attnMeta}>
                {/* El nombre suele ser el mismo handle; repetido no dice nada. */}
                {account?.display_name &&
                  handleSlug(account.display_name).toLowerCase() !==
                    handleSlug(creator.handle).toLowerCase() &&
                  `${account.display_name} · `}
                {account?.city && `${account.city} · `}
                {creator.followers_count.toLocaleString("es-CR")} seguidores
                {est === "rechazada" && creator.rejection_reason && ` · ${creator.rejection_reason}`}
              </div>
            </div>
            <div className={styles.attnRight}>
              {slug && (
                // Abre el perfil público, que es donde vive el book. Sirve
                // también con el creador SIN verificar —`creator_public_profiles`
                // no filtra por `verified`—, que es justo cuando hace falta:
                // hay que ver el material antes de decidir si se verifica.
                <a
                  href={`/ugc/creadores/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                >
                  Ver book
                </a>
              )}
              <VerificacionAcciones profileId={creator.profile_id} tipo="creator" estado={est} />
            </div>
          </div>
        );
      })}
    </TarjetaLista>
  );
}

async function ListaMarcas({
  supabase,
  q,
  estado,
}: {
  supabase: Supabase;
  q: string;
  estado: EstadoCuenta | null;
}) {
  // Todas las marcas, no solo las que ya publicaron: una marca nueva tiene
  // que poder verificarse ANTES de poder publicar (el gate es duro).
  const { data: allBrands } = await supabase
    .from("brand_profiles")
    .select("*")
    .order("verified", { ascending: true })
    .order("brand_name");
  const todas = allBrands ?? [];

  const filtradas = todas.filter(
    (b) => (!estado || estadoCuenta(b) === estado) && coincide(q, [b.brand_name, b.industry, b.location]),
  );

  return (
    <TarjetaLista
      titulo="Marcas"
      mostrados={filtradas.length}
      total={todas.length}
      vacio="Todavía no hay marcas."
    >
      {filtradas.map((brand) => {
        const est = estadoCuenta(brand);
        return (
          <div
            key={brand.profile_id}
            className={`${styles.attnItem} ${styles.mktFila}`}
            style={{ cursor: "default" }}
          >
            <BrandAvatar name={brand.brand_name} logoUrl={brand.logo_url} size={32} radius={9} />
            <div className={styles.attnBody}>
              <div className={styles.attnTitle}>
                {brand.brand_name} <EstadoPill estado={est} femenino />
              </div>
              <div className={styles.attnMeta}>
                {[brand.industry, brand.location].filter(Boolean).join(" · ") || "Sin datos"}
                {est === "rechazada" && brand.rejection_reason && ` · ${brand.rejection_reason}`}
              </div>
            </div>
            <div className={styles.attnRight}>
              {brand.slug && (
                <a
                  href={`/ugc/marcas/${brand.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                >
                  Ver perfil
                </a>
              )}
              <VerificacionAcciones profileId={brand.profile_id} tipo="brand" estado={est} />
            </div>
          </div>
        );
      })}
    </TarjetaLista>
  );
}

async function ListaCampanas({
  supabase,
  q,
  estado,
}: {
  supabase: Supabase;
  q: string;
  estado: CampaignStatus | null;
}) {
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, brand_id, budget_amount, status, created_at")
    .order("created_at", { ascending: false });
  const todas = campaigns ?? [];

  const brandIds = [...new Set(todas.map((c) => c.brand_id))];
  const { data: brands } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };
  const marcaPorId = new Map((brands ?? []).map((b) => [b.profile_id, b.brand_name]));

  const filtradas = todas.filter(
    (c) => (!estado || c.status === estado) && coincide(q, [c.title, marcaPorId.get(c.brand_id)]),
  );

  return (
    <TarjetaLista
      titulo="Campañas"
      mostrados={filtradas.length}
      total={todas.length}
      vacio="Todavía no hay campañas."
    >
      {filtradas.map((campaign) => (
        <div
          key={campaign.id}
          className={`${styles.attnItem} ${styles.mktFila}`}
          style={{ cursor: "default" }}
        >
          <div className={styles.attnBody}>
            <div className={styles.attnTitle}>
              {campaign.title}{" "}
              <Pill
                label={CAMPAIGN_STATUS_LABEL[campaign.status]}
                estilo={CAMPAIGN_STATUS_STYLE[campaign.status]}
              />
            </div>
            <div className={styles.attnMeta}>
              {marcaPorId.get(campaign.brand_id)} · ₡{campaign.budget_amount.toLocaleString("es-CR")} ·{" "}
              {fechaCorta(campaign.created_at)}
            </div>
          </div>
          <div className={styles.attnRight}>
            {(campaign.status === "published" || campaign.status === "in_progress") && (
              <form action={markCampaignCompletedAction}>
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <button type="submit" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
                  Marcar completada
                </button>
              </form>
            )}
          </div>
        </div>
      ))}
    </TarjetaLista>
  );
}

async function ListaAplicaciones({
  supabase,
  q,
  estado,
  totalGeneral,
}: {
  supabase: Supabase;
  q: string;
  estado: ApplicationStatus | null;
  /** Todas, sin filtro: el "3 de 8" del título se lee contra esto. */
  totalGeneral: number;
}) {
  // El estado se filtra en la base y no acá: con el tope puesto, filtrar
  // después dejaría afuera las aplicaciones viejas de ese estado.
  let consulta = supabase
    .from("applications")
    .select("id, campaign_id, creator_id, status, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(MAX_APLICACIONES);
  if (estado) consulta = consulta.eq("status", estado);
  const { data: applications, count } = await consulta;
  const todas = applications ?? [];
  // Las de ese estado, sin el tope. Distinto de totalGeneral cuando hay estado.
  const total = count ?? todas.length;

  const campaignIds = [...new Set(todas.map((a) => a.campaign_id))];
  const creatorIds = [...new Set(todas.map((a) => a.creator_id))];
  const [{ data: campaigns }, { data: creators }] = await Promise.all([
    campaignIds.length
      ? supabase.from("campaigns").select("id, title, brand_id").in("id", campaignIds)
      : Promise.resolve({
          data: [] as { id: string; title: string; brand_id: string }[],
        }),
    creatorIds.length
      ? supabase.from("creator_profiles").select("profile_id, handle").in("profile_id", creatorIds)
      : Promise.resolve({
          data: [] as { profile_id: string; handle: string }[],
        }),
  ]);
  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brands } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };

  const campanaPorId = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const handlePorId = new Map((creators ?? []).map((c) => [c.profile_id, c.handle]));
  const marcaPorId = new Map((brands ?? []).map((b) => [b.profile_id, b.brand_name]));

  const filtradas = todas.filter((a) => {
    const campana = campanaPorId.get(a.campaign_id);
    return coincide(q, [
      handlePorId.get(a.creator_id),
      campana?.title,
      campana && marcaPorId.get(campana.brand_id),
    ]);
  });

  return (
    <TarjetaLista
      titulo="Aplicaciones"
      mostrados={filtradas.length}
      total={totalGeneral}
      vacio="Todavía no hay aplicaciones."
    >
      {filtradas.map((app) => {
        const campana = campanaPorId.get(app.campaign_id);
        const handle = handlePorId.get(app.creator_id);
        return (
          <div key={app.id} className={`${styles.attnItem} ${styles.mktFila}`} style={{ cursor: "default" }}>
            <div className={styles.attnBody}>
              <div className={styles.attnTitle}>
                {handle ? displayHandle(handle) : "Creador"}{" "}
                <Pill
                  label={APPLICATION_STATUS_LABEL[app.status]}
                  estilo={APPLICATION_STATUS_STYLE[app.status]}
                />
              </div>
              <div className={styles.attnMeta}>
                {campana?.title ?? "Campaña"}
                {campana && ` · ${marcaPorId.get(campana.brand_id) ?? "Marca"}`} ·{" "}
                {fechaCorta(app.created_at)}
              </div>
            </div>
          </div>
        );
      })}
      {total > todas.length && (
        <div className={styles.attnMeta} style={{ paddingTop: 12 }}>
          Se muestran las {MAX_APLICACIONES} más recientes de {total}. Filtrá por estado para ver las
          anteriores.
        </div>
      )}
    </TarjetaLista>
  );
}
