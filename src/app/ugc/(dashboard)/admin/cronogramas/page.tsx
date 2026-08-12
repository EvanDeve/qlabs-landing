import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { mesCR, nombreDeMes, sumarMeses } from "@/lib/ugc/cronograma";
import NuevoCronogramaButton from "@/components/ugc/admin/NuevoCronogramaButton";
import styles from "../qos.module.css";

export const dynamic = "force-dynamic";

/**
 * Los cronogramas mensuales, agrupados por mes y con el más nuevo arriba.
 *
 * Se agrupa por mes y no por Hero porque la pregunta que el equipo se hace a
 * fin de mes es "¿cuáles me faltan para septiembre?", no "¿qué hizo Zonna en
 * los últimos seis meses?". Para lo segundo está el expediente del Hero.
 */
export default async function CronogramasPage() {
  const supabase = await createClient();

  const [{ data: heroes }, { data: meses }, { data: columnas }] = await Promise.all([
    supabase.from("agency_clients").select("id, name, logo_url, archived").order("name"),
    supabase.from("hero_calendar_months").select("hero_id, month, status, target").order("month", { ascending: false }),
    supabase.from("content_columns").select("id, is_done"),
  ]);

  const activos = (heroes ?? []).filter((h) => !h.archived);
  const nombreDeHero = new Map((heroes ?? []).map((h) => [h.id, h.name]));

  // Cuántos videos tiene cargado cada cronograma, y cuántos ya se publicaron.
  // Son dos fuentes distintas a propósito: los videos planificados viven en
  // calendar_month_items hasta que se aprueba, y lo publicado son tarjetas del
  // tablero. Antes de aprobar, el segundo número es 0 y así debe ser.
  const [{ data: items }, { data: piezas }] = await Promise.all([
    supabase.from("calendar_month_items").select("hero_id, month"),
    supabase.from("content_pieces").select("brand_id, calendar_month, column_id").not("calendar_month", "is", null),
  ]);

  const terminadas = new Set((columnas ?? []).filter((c) => c.is_done).map((c) => c.id));
  const clave = (heroId: string, mes: string) => `${heroId}|${mes}`;

  const planificados = new Map<string, number>();
  for (const i of items ?? []) planificados.set(clave(i.hero_id, i.month), (planificados.get(clave(i.hero_id, i.month)) ?? 0) + 1);

  const publicados = new Map<string, number>();
  for (const p of piezas ?? []) {
    if (!p.calendar_month || !terminadas.has(p.column_id)) continue;
    const k = clave(p.brand_id, p.calendar_month);
    publicados.set(k, (publicados.get(k) ?? 0) + 1);
  }

  // Agrupados por mes, conservando el orden que ya trae la consulta.
  const porMes = new Map<string, typeof meses>();
  for (const m of meses ?? []) {
    if (!porMes.has(m.month)) porMes.set(m.month, []);
    porMes.get(m.month)!.push(m);
  }

  const mesActual = mesCR();
  const siguiente = sumarMeses(mesActual, 1);
  const heroesSinMesSiguiente = activos.filter(
    (h) => !(meses ?? []).some((m) => m.hero_id === h.id && m.month === siguiente)
  );

  return (
    <>
      {/* Sin <h1> propio: el título de la pantalla lo pone la topbar del shell
          (sale del nav), y repetirlo acá lo dejaba dos veces seguidas. */}
      <div className={styles.sectionHead}>
        <p className={styles.formNote} style={{ maxWidth: "62ch" }}>
          El mes de cada Hero: los videos, sus fechas y su guion. Al aprobarlo, los videos nacen en el pipeline.
        </p>
        <div className={styles.sectionHeadAct}>
          <NuevoCronogramaButton heroes={activos.map((h) => ({ id: h.id, name: h.name }))} mesSugerido={siguiente} />
        </div>
      </div>

      {/* Lo que el equipo necesita ver al entrar acá a fin de mes: a quién le
          falta el mes que viene. Sin esto hay que cruzar mentalmente la lista
          de Heroes contra la de cronogramas. */}
      {heroesSinMesSiguiente.length > 0 && (
        <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "18px" }}>
          <div className={styles.sectionHead}>
            <h2>Sin cronograma de {nombreDeMes(siguiente)}</h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginTop: "10px" }}>
            {heroesSinMesSiguiente.map((h) => (
              <span key={h.id} className={styles.chip}>
                {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {porMes.size === 0 ? (
        <div className={styles.empty}>
          Todavía no hay cronogramas. Empezá por el de {nombreDeMes(siguiente)}.
        </div>
      ) : (
        [...porMes.entries()].map(([mes, filas]) => (
          <div key={mes} className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "18px" }}>
            <div className={styles.sectionHead}>
              <h2 style={{ textTransform: "capitalize" }}>{nombreDeMes(mes)}</h2>
              <span className={styles.chip} style={{ marginLeft: "10px" }}>
                {filas!.length} {filas!.length === 1 ? "Hero" : "Heroes"}
              </span>
            </div>

            <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
              {filas!.map((f) => {
                const k = clave(f.hero_id, f.month);
                const planeados = planificados.get(k) ?? 0;
                const hechos = publicados.get(k) ?? 0;
                const aprobado = f.status === "aprobado";
                // Aprobado manda el número sellado; pendiente, el conteo vivo.
                const meta = aprobado ? (f.target ?? planeados) : planeados;

                return (
                  <Link
                    key={k}
                    href={`/ugc/admin/cronogramas/${f.hero_id}/${f.month}`}
                    className={styles.cronoRow}
                  >
                    <span className={styles.cronoName}>{nombreDeHero.get(f.hero_id) ?? "Hero borrado"}</span>

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
                      {meta === 0 ? "sin videos" : `${meta} ${meta === 1 ? "video" : "videos"}`}
                    </span>

                    {aprobado && meta > 0 && (
                      <span className={styles.cronoCount}>
                        {hechos}/{meta} publicados
                      </span>
                    )}

                    <QosIcon name="chevR" size={15} className={styles.cronoChev} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
}
