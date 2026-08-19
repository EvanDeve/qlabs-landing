import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { agregarVideoAction, borrarCronogramaAction } from "@/lib/actions/cronogramas";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import { parseMes, nombreDeMes, estadoDelGuion } from "@/lib/ugc/cronograma";
import { QosIcon } from "@/lib/ugc/qos-icons";
import CronogramaVideoRow from "@/components/ugc/admin/CronogramaVideoRow";
import CronogramaShareLink from "@/components/ugc/admin/CronogramaShareLink";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * El origen real desde el que se está mirando, para armar el link del Hero.
 *
 * Sale de los headers de la petición y no de NEXT_PUBLIC_SITE_URL, que hoy vale
 * localhost: un link copiado en producción con ese valor sería inservible del
 * otro lado y no habría ninguna señal de que está mal hasta que el cliente
 * escriba diciendo que no le abre.
 */
async function origenDeLaPeticion(): Promise<string> {
  const h = await headers();
  // x-forwarded-* los pone Vercel; el fallback cubre el dev local, donde no hay
  // proxy adelante y el esquema es http.
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * El armado del cronograma de un Hero para un mes.
 *
 * Los videos viven en `calendar_month_items` y todavía NO son tarjetas del
 * pipeline: nacen ahí recién cuando el cliente aprueba. Ver la migración
 * 20260812100000.
 */
export default async function ArmarCronogramaPage({
  params,
}: {
  params: Promise<{ heroId: string; month: string }>;
}) {
  const { heroId, month } = await params;

  // El mes se valida antes de tocar Postgres: un '/septiembre' escrito a mano
  // haría fallar la consulta y la pantalla saldría vacía sin decir por qué.
  const mes = parseMes(month);
  if (!mes) notFound();

  const supabase = await createClient();

  const [{ data: hero }, { data: cronograma }, { data: videos }] = await Promise.all([
    supabase.from("agency_clients").select("id, name").eq("id", heroId).maybeSingle(),
    supabase.from("hero_calendar_months").select("*").eq("hero_id", heroId).eq("month", mes).maybeSingle(),
    supabase
      .from("calendar_month_items")
      .select("*")
      .eq("hero_id", heroId)
      .eq("month", mes)
      // El cronograma se lee como un calendario y no como la bitácora de carga:
      // el orden lo manda la fecha de publicación, con la hora de desempate y
      // la posición de creación al final para que dos videos del mismo momento
      // no se intercambien entre recargas. Los que todavía no tienen fecha van
      // últimos: son justo los que faltan por definir.
      .order("publish_date", { ascending: true, nullsFirst: false })
      .order("publish_time", { ascending: true, nullsFirst: false })
      .order("position", { ascending: true }),
  ]);

  if (!hero || !cronograma) notFound();

  const items = videos ?? [];
  const aprobado = cronograma.status === "aprobado";
  const comentados = items.filter((i) => i.client_comment).length;
  const sinFecha = items.filter((i) => !i.publish_date).length;
  // Cuántos videos ya son tarjetas del tablero. Decide qué le advierte el
  // borrado: sin esto, la única frase posible sería un "no se puede deshacer"
  // que no dice lo que la persona necesita saber.
  const enElPipeline = items.filter((i) => i.piece_id).length;
  // Cuántos guiones faltan por terminar. Es el dato que decide si el mes se
  // puede mandar a revisar: un cronograma con la mitad de los guiones a medias
  // no está listo para que lo vea el cliente.
  const guionesPendientes = items.filter((i) => estadoDelGuion(i).estado !== "completo").length;

  return (
    <>
      {/* Acá el <h2> sí va: la topbar dice "Cronogramas" para toda la sección,
          así que sin esto no se sabría de qué Hero y de qué mes es la pantalla.
          El link de vuelta va arriba, compensando su padding lateral. */}
      <div style={{ marginBottom: "16px" }}>
        <Link href="/admin/cronogramas" className={styles.linkMore} style={{ marginLeft: "-8px" }}>
          <QosIcon name="chevL" size={13} /> Todos los cronogramas
        </Link>
        <h2 className={styles.sectionHeadBig} style={{ textTransform: "capitalize", margin: "6px 0 4px" }}>
          {hero.name} · {nombreDeMes(mes)}
        </h2>
        <p className={styles.formNote}>
          {aprobado
            ? "Aprobado. Los videos ya están en el pipeline."
            : "Pendiente de aprobación. Los videos nacen en el pipeline cuando el cliente lo apruebe."}
        </p>
      </div>

      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span
            className={styles.badgeSt}
            style={{
              background: aprobado ? "var(--ok-bg)" : "var(--warn-bg)",
              color: aprobado ? "var(--ok)" : "var(--warn)",
            }}
          >
            {aprobado ? "Aprobado" : "Pendiente"}
          </span>

          <span className={styles.cronoCount}>
            {items.length} {items.length === 1 ? "video" : "videos"}
            {aprobado && cronograma.target != null && cronograma.target !== items.length
              ? ` · meta sellada en ${cronograma.target}`
              : ""}
          </span>

          {/* Dos avisos que se leen de un vistazo y evitan mandar a revisar un
              cronograma a medias. */}
          {sinFecha > 0 && (
            <span className={styles.chip} style={{ background: "var(--warn-bg)", color: "var(--warn)", borderColor: "var(--warn-line)" }}>
              <QosIcon name="alert" size={12} /> {sinFecha} sin fecha
            </span>
          )}
          {guionesPendientes > 0 && (
            <span className={styles.chip} style={{ background: "var(--warn-bg)", color: "var(--warn)", borderColor: "var(--warn-line)" }}>
              <QosIcon name="doc" size={12} />{" "}
              {guionesPendientes === 1 ? "1 guion sin terminar" : `${guionesPendientes} guiones sin terminar`}
            </span>
          )}
          {items.length > 0 && guionesPendientes === 0 && (
            <span className={styles.chip} style={{ background: "var(--ok-bg)", color: "var(--ok)", borderColor: "var(--ok-line)" }}>
              <QosIcon name="check" size={12} /> Todos los guiones listos
            </span>
          )}
          {comentados > 0 && (
            <span className={styles.chip} style={{ background: "var(--warn-bg)", color: "var(--warn)", borderColor: "var(--warn-line)" }}>
              <QosIcon name="chat" size={12} /> el cliente comentó {comentados}
            </span>
          )}
        </div>
      </div>

      <CronogramaShareLink url={`${await origenDeLaPeticion()}/ugc/cronograma/${cronograma.share_token}`} aprobado={aprobado} />

      <div style={{ display: "grid", gap: "8px", marginBottom: "18px" }}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            Todavía no hay videos. Agregá el primero para empezar a armar el mes.
          </div>
        ) : (
          items.map((item, i) => <CronogramaVideoRow key={item.id} item={item} numero={i + 1} />)
        )}
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <form
          action={async () => {
            "use server";
            await agregarVideoAction(heroId, mes);
          }}
        >
          <button type="submit" className={`${styles.btn} ${styles.btnSoft}`}>
            <QosIcon name="plus" size={15} /> Agregar video
          </button>
        </form>

        {/* El mensaje dice qué se lleva y qué no, y no un "no se puede
            deshacer" genérico: lo que la persona necesita saber antes de
            confirmar es si le va a desaparecer trabajo del tablero. */}
        <ConfirmDeleteButton
          action={async () => {
            "use server";
            await borrarCronogramaAction(heroId, mes);
          }}
          confirmMessage={
            enElPipeline > 0
              ? `Se borra el cronograma de ${nombreDeMes(mes)} y sus ${items.length} videos planificados. ` +
                `Las ${enElPipeline} tarjetas que ya están en el pipeline NO se borran: se sueltan del cronograma y siguen en el tablero.`
              : `Se borra el cronograma de ${nombreDeMes(mes)}` +
                (items.length > 0 ? ` y sus ${items.length} videos planificados` : "") +
                `. Todavía no hay nada en el pipeline, así que no se pierde trabajo.`
          }
          className={`${styles.btn} ${styles.btnGhostDanger}`}
        >
          Borrar cronograma
        </ConfirmDeleteButton>
      </div>
    </>
  );
}
