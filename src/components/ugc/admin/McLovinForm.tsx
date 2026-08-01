"use client";

import { useActionState, useState } from "react";
import { saveAgentSettingsAction, type AgentSettingsState } from "@/lib/actions/agent-settings";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * El cerebro de McLovin, editable sin redeployar.
 *
 * Está partido en campos con nombre y no en un textarea gigante a propósito.
 * Un "system prompt" suelto se degrada solo: cada cambio pisa al anterior, se
 * pierde qué parte hacía qué, y no hay forma de que el sistema exija que algo
 * esté escrito antes de prender una función. Con campos, "qué sabe de Q Labs"
 * vacío puede bloquear el interruptor de afuera, que es justo lo que hace.
 *
 * Lo que sí falta cuando se editan campos es ver el resultado — por eso la
 * página muestra abajo el prompt armado tal cual lo lee el modelo.
 */

/** Enlace de texto plano, para las acciones chiquitas dentro de un hint. */
function Enlace({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        font: "inherit",
        color: "var(--accent)",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Seccion({ titulo, bajada, children }: { titulo: string; bajada: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid var(--line)" }}>
      <h3 style={{ fontSize: "14px", fontWeight: 800, marginBottom: "4px" }}>{titulo}</h3>
      <p style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "16px" }}>{bajada}</p>
      {children}
    </div>
  );
}

const AREA_STYLE = { fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" as const };

export default function McLovinForm({
  nombre,
  persona,
  instrucciones,
  sobreQlabs,
  guionPublico,
  linkAgenda,
  responderDesconocidos,
  // Bajan como props en vez de importarse: agente.ts y agente-publico.ts
  // arrastran los módulos enteros (agenda, fechas, el cliente de Gemini) y acá
  // solo hacen falta los textos.
  personaPorDefecto,
  sobreQlabsArranque,
  guionArranque,
}: {
  nombre: string;
  persona: string;
  instrucciones: string;
  sobreQlabs: string;
  guionPublico: string;
  linkAgenda: string;
  responderDesconocidos: boolean;
  personaPorDefecto: string;
  sobreQlabsArranque: string;
  guionArranque: string;
}) {
  const [state, formAction, isPending] = useActionState<AgentSettingsState, FormData>(saveAgentSettingsAction, null);
  const [personaValue, setPersonaValue] = useState(persona);
  const [sobreValue, setSobreValue] = useState(sobreQlabs);
  const [guionValue, setGuionValue] = useState(guionPublico);
  const [respondeValue, setRespondeValue] = useState(responderDesconocidos);

  return (
    <form action={formAction}>
      <div className={styles.field} style={{ maxWidth: "260px" }}>
        <label>Cómo se llama</label>
        <input name="nombre" defaultValue={nombre} required maxLength={40} className={styles.inp} />
        <p className={styles.fieldHint}>Lo usa para contestar cuando le preguntan quién es.</p>
      </div>

      <Seccion
        titulo="Con el equipo"
        bajada="El recordatorio de la mañana y las respuestas del chat interno salen de acá."
      >
        <div className={styles.field}>
          <label>Quién es y cómo escribe</label>
          <textarea
            name="persona"
            rows={12}
            value={personaValue}
            onChange={(e) => setPersonaValue(e.target.value)}
            placeholder={personaPorDefecto}
            maxLength={4000}
            className={styles.inp}
            style={AREA_STYLE}
          />
          <p className={styles.fieldHint}>
            Si lo dejás vacío usa el texto en gris, que es el que trae de fábrica.{" "}
            {personaValue.trim() && <Enlace onClick={() => setPersonaValue("")}>Volver al original</Enlace>}
          </p>
        </div>

        <div className={styles.field}>
          <label>Instrucciones extra</label>
          <textarea
            name="instrucciones"
            rows={5}
            defaultValue={instrucciones}
            maxLength={4000}
            className={styles.inp}
            placeholder={"Ej: esta semana priorizá lo de Zonna.\nA Kosta Asiatika nombralo completo, no “Kosta”."}
            style={AREA_STYLE}
          />
          <p className={styles.fieldHint}>Se le agregan encima de lo anterior. Sirven para cosas del momento.</p>
        </div>
      </Seccion>

      <Seccion
        titulo="Con gente de afuera"
        bajada="Cuando escribe alguien que no es del equipo, el mensaje siempre queda registrado y te llega un aviso si es la primera vez. Lo de acá define si además le contesta, y cómo. Nunca escribe primero: solo responde a quien le escribió."
      >
        <div className={styles.field}>
          <label>Qué sabe de Q Labs</label>
          <textarea
            name="sobre_qlabs"
            rows={12}
            value={sobreValue}
            onChange={(e) => setSobreValue(e.target.value)}
            maxLength={4000}
            className={styles.inp}
            placeholder="Qué es Q Labs, qué hace y para quién. Lo que no escribas acá, no lo sabe."
            style={AREA_STYLE}
          />
          <p className={styles.fieldHint}>
            Los hechos. Tiene prohibido inventar precios, plazos o servicios que no estén escritos acá.{" "}
            {!sobreValue.trim() && (
              <Enlace onClick={() => setSobreValue(sobreQlabsArranque)}>Usar un texto de arranque</Enlace>
            )}
          </p>
        </div>

        <div className={styles.field}>
          <label>Cómo lleva la conversación</label>
          <textarea
            name="guion_publico"
            rows={10}
            value={guionValue}
            onChange={(e) => setGuionValue(e.target.value)}
            maxLength={4000}
            className={styles.inp}
            placeholder="Qué averiguar primero, qué contar de Q Labs según el caso, cuándo pasar a la reunión."
            style={AREA_STYLE}
          />
          <p className={styles.fieldHint}>
            El comportamiento, no los hechos. Si querés más reuniones, este es el campo que se toca.{" "}
            {!guionValue.trim() && <Enlace onClick={() => setGuionValue(guionArranque)}>Usar un guion de arranque</Enlace>}
          </p>
        </div>

        <div className={styles.field} style={{ maxWidth: "420px" }}>
          <label>Link para agendar</label>
          <input
            name="link_agenda"
            type="url"
            defaultValue={linkAgenda}
            placeholder="https://calendly.com/…"
            className={styles.inp}
          />
          <p className={styles.fieldHint}>
            La persona agenda sola ahí, con los horarios que vos tengas libres. McLovin nunca escribe en el Calendario
            ni confirma horarios. Sin link no lo inventa: dice que el equipo le escribe.
          </p>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: sobreValue.trim() ? "pointer" : "not-allowed",
            opacity: sobreValue.trim() ? 1 : 0.5,
          }}
        >
          <input
            type="checkbox"
            name="responder_desconocidos"
            // Un checkbox deshabilitado no se envía, así que si el texto se
            // vacía esto se guardaría apagado igual. Se muestra apagado para que
            // la pantalla diga lo mismo que se va a guardar.
            checked={respondeValue && Boolean(sobreValue.trim())}
            // Sin nada cargado no hay nada que contestar, así que el switch no
            // se puede prender. El servidor lo vuelve a chequear: esto es
            // comodidad, no el candado.
            disabled={!sobreValue.trim()}
            onChange={(e) => setRespondeValue(e.target.checked)}
            style={{ marginTop: "2px" }}
          />
          <span>
            Contestarle a quien escriba sin ser del equipo
            <span style={{ display: "block", fontWeight: 400, color: "var(--ink-3)", marginTop: "2px" }}>
              Se presenta como asistente automático si le preguntan, y no cotiza ni cierra nada: lleva a la reunión.
            </span>
          </span>
        </label>
      </Seccion>

      <button
        type="submit"
        disabled={isPending}
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ marginTop: "24px" }}
      >
        {isPending ? "Guardando…" : "Guardar"}
      </button>

      {state && "error" in state && (
        <p style={{ marginTop: "12px", fontSize: "13px", fontWeight: 700, color: "var(--risk)" }}>{state.error}</p>
      )}
      {state && "message" in state && (
        <p style={{ marginTop: "12px", fontSize: "13px", fontWeight: 700, color: "var(--ok)" }}>{state.message}</p>
      )}
    </form>
  );
}
