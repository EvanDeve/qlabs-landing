"use client";

import { useActionState } from "react";
import {
  saveWhatsAppSettingsAction,
  testReminderAction,
  type WhatsAppSettingsState,
} from "@/lib/actions/staff";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

const HORAS = Array.from({ length: 24 }, (_, h) => h);

export type StaffWhatsAppRowProps = {
  profileId: string;
  nombre: string;
  rol: string;
  color: string;
  telefono: string | null;
  optIn: boolean;
  reminderHour: number;
};

export default function StaffWhatsAppRow({
  profileId,
  nombre,
  rol,
  color,
  telefono,
  optIn,
  reminderHour,
}: StaffWhatsAppRowProps) {
  const [guardado, guardar, guardando] = useActionState<WhatsAppSettingsState, FormData>(
    saveWhatsAppSettingsAction,
    null
  );
  const [prueba, probar, probando] = useActionState<WhatsAppSettingsState, FormData>(testReminderAction, null);

  const estado = prueba ?? guardado;

  return (
    <div className={styles.settingsRow}>
      <div className={styles.settingsLabel}>
        <strong>
          <span
            className={styles.dot}
            style={{ background: color, width: "9px", height: "9px", marginRight: "7px" }}
          />
          {nombre}
        </strong>
        <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>{rol}</span>
      </div>

      <div style={{ flex: 1, minWidth: "260px" }}>
        <form action={guardar} style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
          <input type="hidden" name="profile_id" value={profileId} />

          <div className={styles.field} style={{ flex: 1, minWidth: "150px", marginBottom: 0 }}>
            <label>Teléfono</label>
            <input
              name="phone_e164"
              defaultValue={telefono ?? ""}
              placeholder="8888-7777"
              inputMode="tel"
              className={styles.inp}
            />
          </div>

          <div className={styles.field} style={{ marginBottom: 0 }}>
            <label>Hora</label>
            <select name="reminder_hour" defaultValue={String(reminderHour)} className={styles.inp}>
              {HORAS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field} style={{ marginBottom: 0 }}>
            <label>Recordatorios</label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                height: "38px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <input type="checkbox" name="wa_opt_in" defaultChecked={optIn} />
              Activos
            </label>
          </div>

          <div className={styles.field} style={{ marginBottom: 0 }}>
            <label style={{ opacity: 0 }}>Guardar</label>
            <button type="submit" disabled={guardando} className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>

        <form action={probar} style={{ marginTop: "10px" }}>
          <input type="hidden" name="profile_id" value={profileId} />
          <button
            type="submit"
            disabled={probando || !telefono}
            title={telefono ? undefined : "Guardá primero un número"}
            className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
          >
            {probando ? "Enviando…" : "Probar ahora"}
          </button>
        </form>

        {estado && "error" in estado && (
          <p className={styles.fieldHint} style={{ color: "var(--risk)", fontWeight: 700 }}>
            {estado.error}
          </p>
        )}
        {estado && "message" in estado && (
          <p className={styles.fieldHint} style={{ color: "var(--ok)", fontWeight: 700 }}>
            {estado.message}
          </p>
        )}
      </div>
    </div>
  );
}
