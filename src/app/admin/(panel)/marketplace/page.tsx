import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import {
  markCampaignCompletedAction,
  setBrandRejectedAction,
  setBrandVerifiedAction,
  setCreatorRejectedAction,
  setCreatorVerifiedAction,
} from "@/lib/actions/admin";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import VerificacionAcciones from "@/components/ugc/admin/VerificacionAcciones";
import MenuFila, { type ItemMenu } from "@/components/ugc/admin/MenuFila";
import { estadoCuenta, type EstadoCuenta } from "@/lib/ugc/estado-cuenta";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_STYLE } from "@/lib/ugc/campaign-status";
import { fechaCorta } from "@/lib/ugc/loyalty";
import {
  PESTANAS_MARKETPLACE,
  coincide,
  iniciales,
  leerEstado,
  leerPestana,
  type PestanaMarketplace,
  rutaFichaCreador,
} from "@/lib/ugc/marketplace-admin";
import { BarraAdmin, FiltroAdmin, PestanasAdmin } from "@/components/ugc/admin/PestanasAdmin";
import type { ApplicationStatus, CampaignStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";
import { displayHandle, handleSlug } from "@/lib/ugc/handles";

export const dynamic = "force-dynamic";

/** Tope de aplicaciones por pantalla. Antes eran las últimas 20 y nada más. */
const MAX_APLICACIONES = 200;

const ESTADOS_CUENTA: EstadoCuenta[] = ["pendiente", "verificada", "rechazada"];
const ESTADOS_CAMPANA = Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[];
const ESTADOS_APLICACION = Object.keys(APPLICATION_STATUS_LABEL) as ApplicationStatus[];

/** "Lo pendiente va siempre arriba" (mockup 1b); lo rechazado, al fondo. */
const ORDEN_ESTADO: Record<EstadoCuenta, number> = { pendiente: 0, verificada: 1, rechazada: 2 };

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

/** Lo que cambia el estado de una cuenta desde el "⋯", según dónde esté. */
function accionesDeEstado(estado: EstadoCuenta, profileId: string, tipo: "creator" | "brand"): ItemMenu[] {
  const verificar = tipo === "creator" ? setCreatorVerifiedAction : setBrandVerifiedAction;
  const rechazar = tipo === "creator" ? setCreatorRejectedAction : setBrandRejectedAction;
  if (estado === "verificada") {
    return [
      {
        tipo: "accion",
        label: "Quitar verificación",
        action: verificar,
        campos: { profile_id: profileId, verified: "false" },
        peligro: true,
      },
    ];
  }
  if (estado === "rechazada") {
    // Levantar el rechazo la devuelve a la cola sin verificarla: es el único
    // camino de vuelta, porque la persona no puede sacarse el rechazo sola.
    return [
      {
        tipo: "accion",
        label: "Devolver a revisión",
        action: rechazar,
        campos: { profile_id: profileId, rechazada: "false" },
      },
    ];
  }
  return [];
}

type Busqueda = { tab?: string; q?: string; estado?: string };

/**
 * El marketplace desde adentro (mockup 1b): cuatro pestañas, cada una una
 * tabla con UNA acción a la vista por fila y el resto en el "⋯". Cada pestaña
 * trae solo sus filas; los números de las pestañas salen de `count` sin traer
 * ninguna, que el egress de Supabase es la primera pared con la que vamos a
 * chocar.
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

  const totales: Record<PestanaMarketplace, number> = { creadores, marcas, campanas, aplicaciones };
  const pendientes: Partial<Record<PestanaMarketplace, number>> = {
    creadores: creadoresPendientes,
    marcas: marcasPendientes,
  };

  const opcionesEstado: { id: string; label: string }[] =
    tab === "creadores" || tab === "marcas"
      ? ESTADOS_CUENTA.map((e) => ({ id: e, label: labelEstadoCuenta(e, tab === "marcas") }))
      : tab === "campanas"
        ? ESTADOS_CAMPANA.map((e) => ({ id: e, label: CAMPAIGN_STATUS_LABEL[e] }))
        : ESTADOS_APLICACION.map((e) => ({ id: e, label: APPLICATION_STATUS_LABEL[e] }));
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
      <p className={styles.bajada}>Sin verificar nadie puede operar. Lo pendiente va siempre arriba.</p>
      <BarraAdmin>
        <PestanasAdmin
          base="/admin/marketplace"
          label="Secciones del marketplace"
          activa={tab}
          pestanas={PESTANAS_MARKETPLACE.map((p) => {
            const n = pendientes[p.id] ?? 0;
            return {
              id: p.id,
              label: p.label,
              count: totales[p.id],
              aviso: { n, texto: n === 1 ? "pendiente" : "pendientes" },
            };
          })}
        />
        <FiltroAdmin
          base="/admin/marketplace"
          tab={tab}
          q={q}
          placeholder={placeholder[tab]}
          estado={estado}
          opciones={opcionesEstado}
        />
      </BarraAdmin>
      {lista}
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof requireArea>>["supabase"];

/**
 * La tarjeta que envuelve cada tabla. Sin título: las pestañas ya dicen qué
 * es y cuántos hay. Cuando hay filtro, el pie dice cuántos coinciden.
 */
function TablaTarjeta({
  mostrados,
  total,
  vacio,
  pie,
  children,
}: {
  mostrados: number;
  total: number;
  vacio: string;
  pie?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (mostrados === 0) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        {total === 0 ? vacio : "Nada coincide con ese filtro."}
      </div>
    );
  }
  return (
    <div className={styles.card} style={{ overflow: "visible" }}>
      {/* Sin overflow: un contenedor con scroll recortaría el menú "⋯". En el
          teléfono las columnas secundarias se esconden y la tabla entra. */}
      {children}
      {(mostrados !== total || pie) && (
        <div className={styles.tablaPie}>
          {mostrados !== total && `${mostrados} de ${total} coinciden con el filtro. `}
          {pie}
        </div>
      )}
    </div>
  );
}

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
    .order("followers_count", { ascending: false });
  const todos = creatorProfiles ?? [];

  const ids = todos.map((c) => c.profile_id);
  const { data: cuentas } = ids.length
    ? await supabase.from("profiles").select("id, display_name, city").in("id", ids)
    : { data: [] };
  const cuentaPorId = new Map((cuentas ?? []).map((p) => [p.id, p]));

  const filtrados = todos
    .filter((c) => {
      const cuenta = cuentaPorId.get(c.profile_id);
      return (
        (!estado || estadoCuenta(c) === estado) &&
        coincide(q, [c.handle, c.instagram_handle, c.tiktok_handle, cuenta?.display_name, cuenta?.city])
      );
    })
    .sort((a, b) => ORDEN_ESTADO[estadoCuenta(a)] - ORDEN_ESTADO[estadoCuenta(b)]);

  return (
    <TablaTarjeta mostrados={filtrados.length} total={todos.length} vacio="Todavía no hay creadores.">
      <table className={styles.tablaLista}>
        <thead>
          <tr>
            <th>Creador</th>
            <th className={styles.colEscritorio}>Ciudad</th>
            <th className={`${styles.numCelda} ${styles.colEscritorio}`}>Seguidores</th>
            <th>Estado</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {filtrados.map((creator) => {
            const account = cuentaPorId.get(creator.profile_id);
            // El handle es lo que arma la URL del media-kit. Puede venir vacío o
            // solo con "@" en filas viejas, y ahí el link caería en un 404.
            const slug = handleSlug(creator.handle);
            const est = estadoCuenta(creator);
            const nombre =
              account?.display_name && handleSlug(account.display_name).toLowerCase() !== slug.toLowerCase()
                ? account.display_name
                : null;
            // Abre el perfil público, que es donde vive el book. Sirve también
            // con el creador SIN verificar —`creator_public_profiles` no filtra
            // por `verified`—, que es justo cuando hace falta: hay que ver el
            // material antes de decidir si se verifica.
            const book = slug ? `/ugc/creadores/${slug}` : null;
            const menu: ItemMenu[] = [
              { tipo: "link", label: "Ver ficha completa", href: rutaFichaCreador(creator.profile_id) },
              ...(book ? [{ tipo: "link" as const, label: "Ver book", href: book, externo: true }] : []),
              ...(slug
                ? [{ tipo: "copiar" as const, label: "Copiar handle", texto: displayHandle(slug) }]
                : []),
              ...accionesDeEstado(est, creator.profile_id, "creator"),
            ];
            return (
              <tr key={creator.profile_id} className={est === "pendiente" ? styles.filaResaltada : undefined}>
                <td>
                  <Link href={rutaFichaCreador(creator.profile_id)} className={styles.celdaNombre}>
                    <span className={styles.esperaAv}>
                      {iniciales(account?.display_name || creator.handle)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <b className={styles.fichaLinkTxt}>{displayHandle(creator.handle)}</b>
                      {nombre && <small>{nombre}</small>}
                      <small className={styles.soloMovil}>
                        {[account?.city, `${creator.followers_count.toLocaleString("es-CR")} seguidores`]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                  </Link>
                </td>
                <td className={styles.colEscritorio}>{account?.city || "—"}</td>
                <td className={`${styles.numCelda} ${styles.colEscritorio}`}>
                  <b>{creator.followers_count.toLocaleString("es-CR")}</b>
                </td>
                <td>
                  <EstadoPill estado={est} femenino={false} />
                  {est === "rechazada" && creator.rejection_reason && (
                    <span className={styles.notaEstado}>{creator.rejection_reason}</span>
                  )}
                </td>
                <td className={est === "pendiente" ? styles.tdAccionesPendiente : undefined}>
                  <div className={styles.celdaAcciones}>
                    {est === "pendiente" ? (
                      <VerificacionAcciones
                        profileId={creator.profile_id}
                        tipo="creator"
                        estado={est}
                        variante="fila"
                      />
                    ) : (
                      book && (
                        <a
                          href={book}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkAccent}
                        >
                          Ver book
                        </a>
                      )
                    )}
                    <MenuFila items={menu} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TablaTarjeta>
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
  const { data: allBrands } = await supabase.from("brand_profiles").select("*").order("brand_name");
  const todas = allBrands ?? [];

  const filtradas = todas
    .filter(
      (b) => (!estado || estadoCuenta(b) === estado) && coincide(q, [b.brand_name, b.industry, b.location]),
    )
    .sort((a, b) => ORDEN_ESTADO[estadoCuenta(a)] - ORDEN_ESTADO[estadoCuenta(b)]);

  return (
    <TablaTarjeta mostrados={filtradas.length} total={todas.length} vacio="Todavía no hay marcas.">
      <table className={styles.tablaLista}>
        <thead>
          <tr>
            <th>Marca</th>
            <th className={styles.colEscritorio}>Rubro</th>
            <th className={styles.colEscritorio}>Ubicación</th>
            <th>Estado</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {filtradas.map((brand) => {
            const est = estadoCuenta(brand);
            const perfil = brand.slug ? `/ugc/marcas/${brand.slug}` : null;
            const menu: ItemMenu[] = [
              ...(perfil
                ? [{ tipo: "link" as const, label: "Ver perfil", href: perfil, externo: true }]
                : []),
              { tipo: "copiar", label: "Copiar nombre", texto: brand.brand_name },
              ...accionesDeEstado(est, brand.profile_id, "brand"),
            ];
            return (
              <tr key={brand.profile_id} className={est === "pendiente" ? styles.filaResaltada : undefined}>
                <td>
                  <div className={styles.celdaNombre}>
                    <BrandAvatar name={brand.brand_name} logoUrl={brand.logo_url} size={30} radius={15} />
                    <span style={{ minWidth: 0 }}>
                      <b>{brand.brand_name}</b>
                      <small className={styles.soloMovil}>
                        {[brand.industry, brand.location].filter(Boolean).join(" · ") || "Sin datos"}
                      </small>
                    </span>
                  </div>
                </td>
                <td className={styles.colEscritorio}>{brand.industry || "—"}</td>
                <td className={styles.colEscritorio}>{brand.location || "—"}</td>
                <td>
                  <EstadoPill estado={est} femenino />
                  {est === "rechazada" && brand.rejection_reason && (
                    <span className={styles.notaEstado}>{brand.rejection_reason}</span>
                  )}
                </td>
                <td className={est === "pendiente" ? styles.tdAccionesPendiente : undefined}>
                  <div className={styles.celdaAcciones}>
                    {est === "pendiente" ? (
                      <VerificacionAcciones
                        profileId={brand.profile_id}
                        tipo="brand"
                        estado={est}
                        variante="fila"
                      />
                    ) : (
                      perfil && (
                        <a
                          href={perfil}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkAccent}
                        >
                          Ver perfil
                        </a>
                      )
                    )}
                    <MenuFila items={menu} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TablaTarjeta>
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
    <TablaTarjeta mostrados={filtradas.length} total={todas.length} vacio="Todavía no hay campañas.">
      <table className={styles.tablaLista}>
        <thead>
          <tr>
            <th>Campaña</th>
            <th className={styles.colEscritorio}>Marca</th>
            <th className={`${styles.numCelda} ${styles.colEscritorio}`}>Presupuesto</th>
            <th className={styles.colEscritorio}>Creada</th>
            <th>Estado</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {filtradas.map((campaign) => {
            const marca = marcaPorId.get(campaign.brand_id) ?? "—";
            const abierta = campaign.status === "published" || campaign.status === "in_progress";
            const menu: ItemMenu[] = abierta
              ? [
                  {
                    tipo: "accion",
                    label: "Marcar completada",
                    action: markCampaignCompletedAction,
                    campos: { campaign_id: campaign.id },
                  },
                ]
              : [];
            return (
              <tr key={campaign.id}>
                <td>
                  <div className={styles.celdaNombre}>
                    <span style={{ minWidth: 0 }}>
                      <b>{campaign.title}</b>
                      <small className={styles.soloMovil}>
                        {marca} · ₡{campaign.budget_amount.toLocaleString("es-CR")}
                      </small>
                    </span>
                  </div>
                </td>
                <td className={styles.colEscritorio}>{marca}</td>
                <td className={`${styles.numCelda} ${styles.colEscritorio}`}>
                  ₡{campaign.budget_amount.toLocaleString("es-CR")}
                </td>
                <td className={styles.colEscritorio} style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                  {fechaCorta(campaign.created_at)}
                </td>
                <td>
                  <Pill
                    label={CAMPAIGN_STATUS_LABEL[campaign.status]}
                    estilo={CAMPAIGN_STATUS_STYLE[campaign.status]}
                  />
                </td>
                <td>
                  <div className={styles.celdaAcciones}>
                    <MenuFila items={menu} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TablaTarjeta>
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
  /** Todas, sin filtro: el "3 de 8" del pie se lee contra esto. */
  totalGeneral: number;
}) {
  // El estado se filtra en la base y no acá: con el tope puesto, filtrar
  // después dejaría afuera las aplicaciones viejas de ese estado.
  let consulta = supabase
    .from("applications")
    .select("id, campaign_id, creator_id, status, created_at", { count: "exact" })
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
      : Promise.resolve({ data: [] as { id: string; title: string; brand_id: string }[] }),
    creatorIds.length
      ? supabase.from("creator_profiles").select("profile_id, handle").in("profile_id", creatorIds)
      : Promise.resolve({ data: [] as { profile_id: string; handle: string }[] }),
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
    <TablaTarjeta
      mostrados={filtradas.length}
      total={totalGeneral}
      vacio="Todavía no hay aplicaciones."
      pie={
        total > todas.length
          ? `Se muestran las ${MAX_APLICACIONES} más recientes de ${total}. Filtrá por estado para ver las anteriores.`
          : undefined
      }
    >
      <table className={styles.tablaLista}>
        <thead>
          <tr>
            <th>Creador</th>
            <th className={styles.colEscritorio}>Campaña</th>
            <th className={styles.colEscritorio}>Marca</th>
            <th className={styles.colEscritorio}>Aplicó</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {filtradas.map((app) => {
            const campana = campanaPorId.get(app.campaign_id);
            const handle = handlePorId.get(app.creator_id);
            return (
              <tr key={app.id}>
                <td>
                  <Link href={rutaFichaCreador(app.creator_id)} className={styles.celdaNombre}>
                    <span className={styles.esperaAv}>{iniciales(handle)}</span>
                    <span style={{ minWidth: 0 }}>
                      <b className={styles.fichaLinkTxt}>{handle ? displayHandle(handle) : "Creador"}</b>
                      <small className={styles.soloMovil}>
                        {campana?.title ?? "Campaña"} ·{" "}
                        {campana ? (marcaPorId.get(campana.brand_id) ?? "Marca") : "Marca"}
                      </small>
                    </span>
                  </Link>
                </td>
                <td className={styles.colEscritorio}>{campana?.title ?? "Campaña"}</td>
                <td className={styles.colEscritorio}>
                  {campana ? (marcaPorId.get(campana.brand_id) ?? "—") : "—"}
                </td>
                <td className={styles.colEscritorio} style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                  {fechaCorta(app.created_at)}
                </td>
                <td>
                  <Pill
                    label={APPLICATION_STATUS_LABEL[app.status]}
                    estilo={APPLICATION_STATUS_STYLE[app.status]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TablaTarjeta>
  );
}
