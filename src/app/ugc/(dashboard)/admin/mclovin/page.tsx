import { formatInTimeZone } from "date-fns-tz";
import { requireDirector } from "@/lib/auth/require-director";
import { COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { AJUSTES_POR_DEFECTO, PERSONA_SEED, armarPersona } from "@/lib/ugc/agente";
import { VENTANA_POR_DEFECTO } from "@/lib/ugc/agenda";
import { SOBRE_QLABS_ARRANQUE, GUION_ARRANQUE, armarCerebroPublico } from "@/lib/ugc/agente-publico";
import McLovinForm from "@/components/ugc/admin/McLovinForm";
import type { WaActionStatus } from "@/lib/database.types";
import styles from "../qos.module.css";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<WaActionStatus, string> = {
  propuesta: "esperando confirmación",
  ejecutada: "hecho",
  descartada: "le dijeron que no",
  vencida: "se venció sin respuesta",
  reemplazada: "le corrigieron los datos",
  fallida: "falló",
};

const ESTADO_COLOR: Record<WaActionStatus, string> = {
  propuesta: "var(--warn, #E8A33D)",
  ejecutada: "var(--ok)",
  descartada: "var(--ink-3)",
  vencida: "var(--ink-3)",
  reemplazada: "var(--ink-3)",
  fallida: "var(--risk)",
};

/**
 * Qué hizo, en una línea.
 *
 * El payload no tiene una forma única —una propuesta guarda la pieza entera,
 * una edición guarda la acción más el título del ítem— así que se lee con
 * cuidado y se cae con gracia: una fila vieja de un formato que ya cambiamos
 * tiene que seguir listándose, no romper la página.
 */
function describirAccion(kind: string, payload: Record<string, unknown>): string {
  // Las dos ramas de crear comparten payload. 'crear_pieza' sigue apareciendo
  // en filas viejas que fueron grabaciones, de cuando todo era una tarjeta del
  // tablero (ver 20260802400000): por eso el destino se lee de `tipo` y no del
  // kind, que en esas filas diría lo que se hizo entonces, no lo que hoy haría.
  if (kind === "crear_pieza" || kind === "crear_evento") {
    const esGrabacion = payload.tipo === "grabar";
    const destino = esGrabacion ? "Grabar" : "Publicar";
    return `Crear "${payload.titulo ?? "sin título"}" — ${payload.cliente ?? "sin cliente"} — ${destino} el ${payload.fecha ?? "?"}`;
  }

  const accion = (payload.accion ?? {}) as Record<string, unknown>;
  const titulo = typeof payload.titulo === "string" ? `"${payload.titulo}"` : "un pendiente";

  // De quién era la tarjeta, si no era de quien lo pidió. Desde que cualquiera
  // puede tocar cualquier cosa, "quién lo pidió" dejó de contar la historia
  // entera: lo que hay que poder auditar es sobre el trabajo de quién cayó.
  const dueno = typeof payload.dueno === "string" ? ` · era de ${payload.dueno}` : "";

  if (kind === "mover_pieza") return `Mover ${titulo} a ${accion.columna ?? "otra columna"}${dueno}`;
  if (kind === "marcar_hecho") return `Marcar ${titulo} como hecho${dueno}`;
  if (kind === "reprogramar") return `Reprogramar ${titulo} para el ${accion.fecha ?? "?"}${dueno}`;
  return kind;
}

/** Un prompt tal cual lo lee el modelo, plegado para que no tape la página. */
function Prompt({ titulo, texto, vacio }: { titulo: string; texto: string | null; vacio?: string }) {
  return (
    <details style={{ marginBottom: "10px" }}>
      <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>{titulo}</summary>
      {texto === null ? (
        <p style={{ marginTop: "10px", fontSize: "12px", color: "var(--ink-3)" }}>{vacio}</p>
      ) : (
        <pre
          style={{
            marginTop: "10px",
            padding: "14px",
            background: "var(--surface-3)",
            borderRadius: "10px",
            fontSize: "12px",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "var(--font-mono)",
          }}
        >
          {texto}
        </pre>
      )}
    </details>
  );
}

export default async function McLovinPage() {
  // Ruta de Sistema: solo directores. La RLS igual no le devolvería
  // las filas a nadie más, pero rebotar es mejor que una página vacía.
  const { supabase } = await requireDirector();

  const [{ data: ajustes }, { data: acciones }, { data: publicos }] = await Promise.all([
    supabase
      .from("agent_settings")
      // `*` por lo mismo que en getAjustesAgente: con la lista de columnas, un
      // deploy anterior a la migración 20260811120000 dejaría esta pantalla
      // mostrando el cerebro vacío como si nadie lo hubiera cargado nunca.
      .select("*")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("wa_agent_actions")
      .select("id, profile_id, kind, payload, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("wa_public_messages")
      .select("id, phone_e164, direction, body, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const profileIds = [...new Set((acciones ?? []).map((a) => a.profile_id))];
  const { data: perfiles } = profileIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [] };
  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

  const nombre = ajustes?.nombre ?? AJUSTES_POR_DEFECTO.nombre;

  // Lo mismo que arma el webhook, para poder mostrarlo tal cual.
  const cerebro = {
    ...AJUSTES_POR_DEFECTO,
    nombre,
    persona: ajustes?.persona ?? "",
    instrucciones: ajustes?.instrucciones ?? "",
    sobreQlabs: ajustes?.sobre_qlabs ?? "",
    guionPublico: ajustes?.guion_publico ?? "",
    linkAgenda: ajustes?.link_agenda ?? "",
    responderDesconocidos: ajustes?.responder_desconocidos ?? false,
  };

  // Cuántas personas distintas escribieron, no cuántos mensajes: dos números
  // que escribieron una vez cada uno importan más que uno que escribió veinte.
  const numerosDistintos = new Set((publicos ?? []).map((m) => m.phone_e164)).size;

  return (
    <div>
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
        <div className={styles.sectionHead}>
          <h2>Personalidad</h2>
        </div>
        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "16px" }}>
          Esto es lo que {nombre} lee antes de escribir cualquier mensaje — el recordatorio de la mañana y las
          respuestas del chat salen de acá. Se aplica al toque, sin redeployar.
        </p>

        <McLovinForm
          nombre={nombre}
          persona={ajustes?.persona ?? ""}
          instrucciones={ajustes?.instrucciones ?? ""}
          sobreQlabs={ajustes?.sobre_qlabs ?? ""}
          guionPublico={ajustes?.guion_publico ?? ""}
          linkAgenda={ajustes?.link_agenda ?? ""}
          responderDesconocidos={ajustes?.responder_desconocidos ?? false}
          diasProximas={ajustes?.dias_proximas ?? VENTANA_POR_DEFECTO.diasProximas}
          diasVencidas={ajustes?.dias_vencidas ?? VENTANA_POR_DEFECTO.diasVencidas}
          maxSinFecha={ajustes?.max_sin_fecha ?? VENTANA_POR_DEFECTO.maxSinFecha}
          personaPorDefecto={PERSONA_SEED}
          sobreQlabsArranque={SOBRE_QLABS_ARRANQUE}
          guionArranque={GUION_ARRANQUE}
        />

        <p
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid var(--line)",
            fontSize: "12px",
            color: "var(--ink-3)",
          }}
        >
          Lo que escribas acá cambia cómo habla, no lo que puede hacer. Que no invente clientes ni fechas, que solo
          toque pendientes de quien le escribe, que no pueda crear nada sin que se lo confirmen y que no cotice ni
          cierre tratos con nadie de afuera está en el código y no se apaga desde esta pantalla.
        </p>
      </div>

      {/* Editar campos sueltos y no ver el resultado es tunear a ciegas. Acá
          está el texto exacto que recibe el modelo, con lo editable y lo fijo
          juntos, que es como lo lee. */}
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
        <div className={styles.sectionHead}>
          <h2>El cerebro armado</h2>
        </div>
        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "16px" }}>
          Esto es literalmente lo que lee {nombre} antes de cada mensaje. Incluye las reglas fijas que no se editan
          desde arriba. Se actualiza cuando guardás.
        </p>

        <Prompt titulo="Cuando le escribe el equipo" texto={armarPersona(cerebro)} />
        <Prompt
          titulo="Cuando le escribe alguien de afuera"
          texto={
            cerebro.sobreQlabs.trim()
              ? armarCerebroPublico({
                  nombre: cerebro.nombre,
                  sobreQlabs: cerebro.sobreQlabs,
                  guionPublico: cerebro.guionPublico,
                  linkAgenda: cerebro.linkAgenda,
                })
              : null
          }
          vacio="Sin nada cargado en “Qué sabe de Q Labs”, no le contesta a nadie de afuera."
        />
      </div>

      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
        <div className={styles.sectionHead}>
          <h2>Gente de afuera ({numerosDistintos})</h2>
        </div>
        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "16px" }}>
          Todo lo que escribe alguien que no es del equipo queda acá, conteste {nombre} o no.
        </p>

        {(publicos ?? []).length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--ink-3)" }}>Todavía no escribió nadie de afuera.</p>
        ) : (
          (publicos ?? []).map((msg) => (
            <div key={msg.id} className={styles.attnItem} style={{ cursor: "default" }}>
              <span
                className={styles.dot}
                style={{
                  background:
                    msg.status === "failed" ? "var(--risk)" : msg.direction === "in" ? "var(--ok)" : "var(--accent)",
                  width: "8px",
                  height: "8px",
                }}
              />
              <div className={styles.attnBody}>
                <div className={styles.attnTitle}>{msg.error ?? msg.body}</div>
                <div className={styles.attnMeta}>
                  {msg.phone_e164} · {msg.direction === "in" ? "escribió" : `contestó ${nombre}`} ·{" "}
                  {formatInTimeZone(new Date(msg.created_at), COSTA_RICA_TZ, "dd/MM HH:mm")}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Lo que hizo</h2>
        </div>
        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "16px" }}>
          Cada vez que {nombre} toca el tablero desde una conversación queda registrado acá, con quién se lo pidió.
        </p>

        {(acciones ?? []).length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--ink-3)" }}>Todavía no tocó nada.</p>
        ) : (
          (acciones ?? []).map((accion) => (
            <div key={accion.id} className={styles.attnItem} style={{ cursor: "default" }}>
              <span
                className={styles.dot}
                style={{ background: ESTADO_COLOR[accion.status], width: "8px", height: "8px" }}
              />
              <div className={styles.attnBody}>
                <div className={styles.attnTitle}>
                  {describirAccion(accion.kind, accion.payload as Record<string, unknown>)}
                </div>
                <div className={styles.attnMeta}>
                  {nombrePorId.get(accion.profile_id) ?? "Sin nombre"} · {ESTADO_LABEL[accion.status]}
                  {accion.error ? ` (${accion.error})` : ""} ·{" "}
                  {formatInTimeZone(new Date(accion.created_at), COSTA_RICA_TZ, "dd/MM HH:mm")}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
