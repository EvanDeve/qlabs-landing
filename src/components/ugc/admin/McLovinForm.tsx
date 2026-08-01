"use client";

import { useActionState, useState } from "react";
import { saveAgentSettingsAction, type AgentSettingsState } from "@/lib/actions/agent-settings";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * La personalidad del agente, editable sin redeployar.
 *
 * El campo `persona` vacío NO es "sin personalidad": es "usá la de fábrica". Por
 * eso el default va de placeholder y no de valor inicial — así se ve en gris lo
 * que el agente usa hoy, y vaciar el campo es una forma explícita de volver ahí.
 * Guardar una copia del default como valor haría que futuras mejoras al texto
 * base nunca llegaran a producción.
 */
export default function McLovinForm({
  nombre,
  persona,
  instrucciones,
  sobreQlabs,
  responderDesconocidos,
  // Bajan como props en vez de importarse: agente.ts y agente-publico.ts
  // arrastran los módulos enteros (agenda, fechas, el cliente de Gemini) y acá
  // solo hacen falta los textos.
  personaPorDefecto,
  sobreQlabsArranque,
}: {
  nombre: string;
  persona: string;
  instrucciones: string;
  sobreQlabs: string;
  responderDesconocidos: boolean;
  personaPorDefecto: string;
  sobreQlabsArranque: string;
}) {
  const [state, formAction, isPending] = useActionState<AgentSettingsState, FormData>(saveAgentSettingsAction, null);
  const [personaValue, setPersonaValue] = useState(persona);
  const [sobreValue, setSobreValue] = useState(sobreQlabs);
  const [respondeValue, setRespondeValue] = useState(responderDesconocidos);

  return (
    <form action={formAction}>
      <div className={styles.field} style={{ maxWidth: "260px" }}>
        <label>Cómo se llama</label>
        <input name="nombre" defaultValue={nombre} required maxLength={40} className={styles.inp} />
        <p className={styles.fieldHint}>Lo usa para contestar cuando le preguntan quién es.</p>
      </div>

      <div className={styles.field}>
        <label>Quién es y cómo escribe</label>
        <textarea
          name="persona"
          rows={14}
          value={personaValue}
          onChange={(e) => setPersonaValue(e.target.value)}
          placeholder={personaPorDefecto}
          maxLength={4000}
          className={styles.inp}
          style={{ fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }}
        />
        <p className={styles.fieldHint}>
          Si lo dejás vacío usa el texto en gris, que es el que trae de fábrica.{" "}
          {personaValue.trim() && (
            <button
              type="button"
              onClick={() => setPersonaValue("")}
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
              Volver al original
            </button>
          )}
        </p>
      </div>

      <div className={styles.field}>
        <label>Instrucciones extra</label>
        <textarea
          name="instrucciones"
          rows={6}
          defaultValue={instrucciones}
          maxLength={4000}
          className={styles.inp}
          placeholder={"Ej: esta semana priorizá lo de Zonna.\nA Kosta Asiatika nombralo siempre completo, no “Kosta”."}
          style={{ fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }}
        />
        <p className={styles.fieldHint}>Se le agregan encima de lo anterior. Sirven para cosas del momento.</p>
      </div>

      <div
        style={{
          marginTop: "24px",
          paddingTop: "20px",
          borderTop: "1px solid var(--line)",
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 800, marginBottom: "4px" }}>Gente de afuera del equipo</h3>
        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "16px" }}>
          Cuando alguien que no es del equipo escribe al número, el mensaje siempre queda registrado y te llega un
          aviso si es la primera vez. Lo que decidís acá es si además le contesta. Nunca escribe primero: solo
          responde a quien le escribió.
        </p>

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
            style={{ fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" }}
          />
          <p className={styles.fieldHint}>
            Es todo lo que sabe: tiene prohibido inventar precios, plazos o servicios que no estén escritos acá.{" "}
            {!sobreValue.trim() && (
              <button
                type="button"
                onClick={() => setSobreValue(sobreQlabsArranque)}
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
                Usar un texto de arranque
              </button>
            )}
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
              Se presenta como asistente automático si le preguntan, y no cierra tratos ni promete llamadas.
            </span>
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ marginTop: "20px" }}
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
