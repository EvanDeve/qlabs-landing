import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import { creatorPayout } from "@/lib/ugc/payout";
import { dueLabel } from "@/lib/ugc/creator-task";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import { estadoDeNivel, type Nivel } from "@/lib/ugc/loyalty";
import { displayHandle } from "@/lib/ugc/handles";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";
import PantallaHeader from "@/components/ugc/PantallaHeader";

export const dynamic = "force-dynamic";

const colones = (n: number) => `₡${n.toLocaleString("es-CR")}`;

/**
 * Fecha límite de una entrega. No existe como columna: se deriva de cuándo la
 * marca aceptó más los días que la campaña dio de plazo. Si falta cualquiera de
 * los dos, no hay fecha — y eso se muestra como "sin fecha", nunca como vencido.
 */
function fechaLimite(acceptedAt: string | null, deadlineDays: number | null): Date | null {
  if (!acceptedAt || !deadlineDays) return null;
  const d = new Date(acceptedAt);
  d.setDate(d.getDate() + deadlineDays);
  return d;
}

function diasRestantes(limite: Date): number {
  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const limSinHora = new Date(limite.getFullYear(), limite.getMonth(), limite.getDate());
  return Math.round((limSinHora.getTime() - hoySinHora.getTime()) / 86_400_000);
}

/**
 * Un `date` de Postgres ("2026-08-21") partido a mano y NO con `new Date(s)`:
 * el constructor lo lee como medianoche UTC y en Costa Rica (UTC-6) eso corre
 * el día para atrás. Es la misma razón por la que existe `daysUntil`.
 */
function diaLocal(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function diaYMes(d: Date): { dia: string; mes: string } {
  return {
    dia: String(d.getDate()).padStart(2, "0"),
    mes: d.toLocaleDateString("es-CR", { month: "short" }).replace(".", ""),
  };
}

const fechaCortaDe = (d: Date) => `${diaYMes(d).dia} ${diaYMes(d).mes}`;

type ItemAgenda = {
  id: string;
  cuando: number;
  dia: string;
  mes: string;
  titulo: string;
  detalle: string;
  href: string;
};

export default async function CreadorHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: applications },
    { data: tasks },
    { data: taskColumns },
    { count: bookCount },
    { data: perfil },
    { data: perfilCreador },
    { data: puntos },
    { data: umbrales },
    { data: publicadas },
  ] = await Promise.all([
    supabase.from("applications").select("*").eq("creator_id", user!.id),
    supabase.from("creator_tasks").select("*").eq("creator_id", user!.id),
    supabase
      .from("creator_task_columns")
      .select("*")
      .eq("creator_id", user!.id)
      .order("position", { ascending: true }),
    supabase
      .from("portfolio_items")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", user!.id),
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user!.id).maybeSingle(),
    supabase.from("creator_profiles").select("handle").eq("profile_id", user!.id).maybeSingle(),
    supabase.from("creator_points").select("total_points").eq("creator_id", user!.id).maybeSingle(),
    supabase.from("level_thresholds").select("*").order("min_points"),
    // Solo los ids: alcanza para contar las que todavía no miró.
    supabase.from("campaigns").select("id").eq("status", "published"),
  ]);

  const apps = applications ?? [];
  const campaignIds = [...new Set(apps.map((a) => a.campaign_id))];
  const { data: campaigns } = campaignIds.length
    ? await supabase
        .from("campaigns")
        .select("id, title, budget_amount, deadline_days, brand_id, deliverables")
        .in("id", campaignIds)
    : { data: [] };
  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brands } = brandIds.length
    ? await supabase.from("brand_public_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };
  const brandNameById = new Map((brands ?? []).map((b) => [b.profile_id, b.brand_name]));

  const enProduccion = apps.filter((a) => a.status === "accepted");
  const esperandoMarca = apps.filter((a) => a.status === "pending" || a.status === "reviewing");
  // "Por cobrar" incluye lo entregado y lo aprobado: el pago se coordina por
  // fuera y no hay registro de que se haya hecho, así que aprobado ≠ cobrado.
  const porCobrar = apps.filter((a) => a.status === "delivered" || a.status === "approved");

  const montoPorCobrar = porCobrar.reduce((sum, a) => {
    const c = campaignById.get(a.campaign_id);
    return sum + (c ? creatorPayout(c.budget_amount) : 0);
  }, 0);

  // "Promos nuevas" son las publicadas a las que todavía NO aplicó. No es
  // "publicadas esta semana": lo que le sirve saber es cuántas le quedan por
  // mirar, no cuántas nacieron.
  const idsAplicados = new Set(apps.map((a) => a.campaign_id));
  const promosNuevas = (publicadas ?? []).filter((c) => !idsAplicados.has(c.id)).length;

  const totalPoints = puntos?.total_points ?? 0;
  const escalera: Nivel[] = umbrales ?? [{ level: 1, name: "Bronce", min_points: 0 }];
  const { actual } = estadoDeNivel(totalPoints, escalera);

  const nombre = perfilCreador?.handle
    ? displayHandle(perfilCreador.handle)
    : perfil?.display_name ?? "Tu perfil";

  const columnas = taskColumns ?? [];
  // Qué cuenta como terminado lo define la columna (`is_done`), no su nombre ni
  // su posición: el creador arma sus propias columnas y puede llamarlas como
  // quiera, así que buscar "publicado" por texto no serviría.
  const columnasHechas = new Set(columnas.filter((c) => c.is_done).map((c) => c.id));
  const tareasAbiertas = (tasks ?? []).filter((t) => !columnasHechas.has(t.column_id));

  // Entregas pendientes ordenadas por urgencia. Las que no tienen fecha al final.
  const entregas = enProduccion
    .map((a) => {
      const c = campaignById.get(a.campaign_id);
      const limite = fechaLimite(a.accepted_at, c?.deadline_days ?? null);
      const entregables = Array.isArray(c?.deliverables)
        ? (c.deliverables as { type: string; qty: number }[])
        : [];
      return {
        id: a.id,
        titulo: c?.title ?? "Campaña",
        marca: c ? brandNameById.get(c.brand_id) ?? null : null,
        monto: c ? creatorPayout(c.budget_amount) : null,
        entregables,
        limite,
        dias: limite ? diasRestantes(limite) : null,
      };
    })
    .sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity));

  // ── La tarjeta de acción: lo único que hay que hacer ahora ──
  const urgente = entregas.find((e) => e.dias !== null && e.dias <= 3) ?? null;

  let accion: { arriba: string | null; titulo: string; nota: React.ReactNode; cta: string; href: string };

  if (urgente) {
    // "Entregá el Reel de Zonna" cuando hay un solo entregable; con varios, la
    // frase se vuelve impronunciable y el detalle ya los lista abajo.
    const unico =
      urgente.entregables.length === 1 && urgente.entregables[0].qty === 1
        ? FORMAT_LABEL[urgente.entregables[0].type] ?? urgente.entregables[0].type
        : null;
    const dias = urgente.dias!;
    accion = {
      arriba: null,
      titulo: urgente.marca
        ? `Entregá ${unico ? `el ${unico}` : "el trabajo"} de ${urgente.marca}`
        : `Entregá ${urgente.titulo}`,
      nota: (
        <>
          {urgente.monto !== null && `${colones(urgente.monto)} neto · `}
          {urgente.entregables.length > 0 &&
            `${urgente.entregables.map((d) => `${d.qty}× ${FORMAT_LABEL[d.type] ?? d.type}`).join(", ")} · `}
          <span className={dias < 0 ? styles.homeVencido : undefined}>
            {dias < 0
              ? `venció el ${fechaCortaDe(urgente.limite!)}`
              : dias === 0
                ? "se entrega hoy"
                : dias === 1
                  ? "se entrega mañana"
                  : `se entrega en ${dias} días`}
          </span>
        </>
      ),
      cta: "Entregar ahora",
      href: "/ugc/creador/aplicaciones",
    };
  } else if ((bookCount ?? 0) === 0) {
    accion = {
      arriba: null,
      titulo: "Tu book está vacío",
      nota: "Las marcas lo miran antes de aceptarte. Subí al menos una pieza.",
      cta: "Subir una pieza",
      href: "/ugc/creador/book",
    };
  } else {
    accion = {
      arriba: "Todo al día",
      titulo: "No tenés entregas pendientes",
      nota:
        promosNuevas > 0
          ? `Hay ${promosNuevas} ${promosNuevas === 1 ? "promo nueva" : "promos nuevas"} para vos.`
          : "Cuando una marca publique una promo nueva, te va a aparecer acá.",
      cta: "Ver promos nuevas",
      href: "/ugc/creador/promos",
    };
  }

  // ── La agenda: lo que viene, con fecha ──
  const agenda: ItemAgenda[] = [];

  for (const t of tareasAbiertas) {
    if (!t.due_date) continue;
    const d = diaLocal(t.due_date);
    const { dia, mes } = diaYMes(d);
    const cuando = dueLabel(t.due_date);
    agenda.push({
      id: `t-${t.id}`,
      cuando: d.getTime(),
      dia,
      mes,
      titulo: t.title,
      detalle: [cuando.charAt(0).toUpperCase() + cuando.slice(1), t.notes].filter(Boolean).join(" · "),
      href: "/ugc/creador/pipeline",
    });
  }

  for (const e of entregas) {
    if (!e.limite) continue;
    const { dia, mes } = diaYMes(e.limite);
    agenda.push({
      id: `e-${e.id}`,
      cuando: e.limite.getTime(),
      dia,
      mes,
      titulo: e.marca ? `Entrega de ${e.marca}` : "Entrega",
      detalle: e.titulo,
      href: "/ugc/creador/aplicaciones",
    });
  }

  agenda.sort((a, b) => a.cuando - b.cuando);

  // ── Y si no hay agenda, qué está esperando del lado de las marcas ──
  // Ojo: no hay forma de saber si la marca ABRIÓ la aplicación —no se registra—
  // así que estas filas dicen el estado real, no "vio tu aplicación".
  const enVuelo = [...esperandoMarca]
    .sort((a, b) => (a.status === "reviewing" ? -1 : 1) - (b.status === "reviewing" ? -1 : 1))
    .slice(0, 4)
    .map((a) => {
      const c = campaignById.get(a.campaign_id);
      const marca = c ? brandNameById.get(c.brand_id) ?? "La marca" : "La marca";
      const desde = fechaCortaDe(new Date(a.status_changed_at));
      return {
        id: a.id,
        titulo:
          a.status === "reviewing" ? `${marca} está revisando tu aplicación` : `${marca} todavía no responde`,
        detalle: a.status === "reviewing" ? `En revisión desde el ${desde}` : `Aplicaste el ${desde}`,
      };
    });

  const stats = [
    { num: enProduccion.length, label: "en producción" },
    { num: esperandoMarca.length, label: "esperando marca" },
    { num: promosNuevas, label: promosNuevas === 1 ? "promo nueva" : "promos nuevas" },
  ];

  return (
    <div>
      {/* Esta pantalla no abre con un título sino con la identidad, así que va
          como bloque entero en el lugar del título — la campana la sigue
          acompañando en la misma fila. */}
      <PantallaHeader
        titulo={
          <Link href="/ugc/creador/perfil" className={styles.homeIdentidad} title="Ver mi perfil">
            {/* Sin el "@": como inicial, todos los creadores tendrían la misma. */}
            <BrandAvatar name={nombre.replace(/^@/, "")} logoUrl={perfil?.avatar_url} size={46} radius={23} />
            <div style={{ minWidth: 0 }}>
              <div className={styles.homeNombre}>{nombre}</div>
              <div className={styles.homeMeta}>Nivel {actual?.name ?? "Bronce"} · verificado</div>
            </div>
          </Link>
        }
      />

      <div className={styles.homeCobrarLabel}>Por cobrar</div>
      <div className={styles.homeCobrarMonto}>{colones(montoPorCobrar)}</div>
      <div className={styles.homeCobrarNota}>
        {porCobrar.length > 0
          ? `De ${porCobrar.length} ${porCobrar.length === 1 ? "entrega" : "entregas"} · Q Labs lo coordina por fuera`
          : "Todavía no tenés entregas por cobrar"}
      </div>

      <div className={styles.homeStats}>
        {stats.map((s) => (
          <div key={s.label} className={styles.recStat}>
            <div className={styles.recStatNum}>{s.num}</div>
            <div className={styles.recStatLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className={styles.homeCard}>
        {accion.arriba && (
          <div className={styles.homeEstadoLinea}>
            <span className={styles.homePunto} />
            {accion.arriba}
          </div>
        )}
        <div className={styles.homeCardTitulo}>{accion.titulo}</div>
        <div className={styles.homeCardNota}>{accion.nota}</div>
        <Link href={accion.href} className={styles.btnAplicar} style={{ display: "grid", placeItems: "center" }}>
          {accion.cta}
        </Link>
      </div>

      {agenda.length > 0 ? (
        <div className={styles.homeLista}>
          {agenda.slice(0, 4).map((item) => (
            <Link key={item.id} href={item.href} className={styles.homeFila}>
              <div className={styles.homeFecha}>
                <div className={styles.homeFechaDia}>{item.dia}</div>
                <div className={styles.homeFechaMes}>{item.mes}</div>
              </div>
              <span className={styles.homeFechaSep} />
              <div className={styles.homeFilaTexto}>
                <div className={styles.homeFilaTitulo}>{item.titulo}</div>
                <div className={styles.homeFilaDetalle}>{item.detalle}</div>
              </div>
              <span className={styles.homeChevron}>
                <QosIcon name="chevR" size={17} />
              </span>
            </Link>
          ))}
        </div>
      ) : enVuelo.length > 0 ? (
        <div className={styles.homeLista}>
          {enVuelo.map((a) => (
            <Link key={a.id} href="/ugc/creador/aplicaciones" className={styles.homeFila}>
              <span className={styles.homePuntoFila} />
              <div className={styles.homeFilaTexto}>
                <div className={styles.homeFilaTitulo}>{a.titulo}</div>
                <div className={styles.homeFilaDetalle}>{a.detalle}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
