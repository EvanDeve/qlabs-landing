"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import {
  actualizarPerfilMiembroAction,
  cambiarConsentimientoAction,
  pedirEliminacionAction,
  type EstadoPerfil,
} from "@/lib/actions/close-friends";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import styles from "@/styles/qos.module.css";

// 16 px de letra en todo campo: con menos, iOS hace zoom al enfocarlo.
const CAMPO: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  fontSize: 16,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid rgba(10,11,16,0.12)",
  background: "#fff",
  color: "#0A0B10",
};
const ETIQUETA: React.CSSProperties = { display: "grid", gap: 6, fontSize: 14.5, fontWeight: 700 };

export function DatosMiembro({ fullName, phone, agentName }: { fullName: string; phone: string; agentName: string }) {
  const [estado, accion, guardando] = useActionState<EstadoPerfil, FormData>(actualizarPerfilMiembroAction, null);

  return (
    <form action={accion} className={`${styles.card} ${styles.cardPad}`} style={{ display: "grid", gap: 14 }}>
      <label style={ETIQUETA}>
        Nombre completo
        <input name="full_name" defaultValue={fullName} autoComplete="name" required maxLength={80} style={CAMPO} />
      </label>
      <label style={ETIQUETA}>
        WhatsApp
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          // Se muestra sin el +506: es lo que la persona escribió.
          defaultValue={phone.replace(/^\+506/, "")}
          required
          style={CAMPO}
        />
      </label>
      <label style={ETIQUETA}>
        Nombre de agente
        <input
          name="agent_name"
          defaultValue={agentName}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü._]{3,20}"
          style={CAMPO}
        />
      </label>
      {estado?.error && <p style={{ color: "var(--risk)", fontSize: 14.5, fontWeight: 600 }}>{estado.error}</p>}
      {estado?.ok && <p style={{ color: "#0E7A53", fontSize: 14.5, fontWeight: 700 }}>{estado.ok}</p>}
      <button type="submit" disabled={guardando} className={styles.btnAplicar}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export type Permiso = {
  kind: "share_with_brand" | "whatsapp_marketing";
  brandId: string | null;
  titulo: string;
  detalle: string;
  logo?: { nombre: string; url: string | null };
  granted: boolean;
};

/**
 * Los permisos opcionales. Cada interruptor guarda al tocarlo: es un sí o un
 * no, y un botón de "Guardar" aparte deja a la persona creyendo que ya lo
 * cambió. Se muestra el cambio al instante (optimista) y, si la base lo
 * rechaza, vuelve solo al recargar la pantalla.
 */
export function PermisosMiembro({ permisos }: { permisos: Permiso[] }) {
  const [, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vista, cambiar] = useOptimistic(
    permisos,
    (actual, { i, granted }: { i: number; granted: boolean }) =>
      actual.map((p, j) => (j === i ? { ...p, granted } : p))
  );

  return (
    <div className={styles.histCard}>
      {vista.map((p, i) => (
        <label key={`${p.kind}-${p.brandId}`} className={styles.usadoFila} style={{ cursor: "pointer", minHeight: 56 }}>
          {p.logo ? (
            <BrandAvatar name={p.logo.nombre} logoUrl={p.logo.url} size={38} radius={12} />
          ) : (
            <span style={{ width: 38, height: 38, borderRadius: 12, background: "#E7F7F1", display: "grid", placeItems: "center" }} aria-hidden>
              💬
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div className={styles.usadoTitulo}>{p.titulo}</div>
            <div className={styles.usadoDetalle}>{p.detalle}</div>
          </div>
          <input
            type="checkbox"
            role="switch"
            checked={p.granted}
            aria-label={p.titulo}
            onChange={(e) => {
              const granted = e.target.checked;
              const fd = new FormData();
              fd.set("kind", p.kind);
              if (p.brandId) fd.set("brand_id", p.brandId);
              fd.set("granted", String(granted));
              setError(null);
              empezar(async () => {
                cambiar({ i, granted });
                const r = await cambiarConsentimientoAction(fd);
                if (r.error) setError(r.error);
              });
            }}
            style={{ width: 22, height: 22, accentColor: "#705CF6", flexShrink: 0 }}
          />
        </label>
      ))}
      {error && <p style={{ color: "var(--risk)", fontSize: 14, padding: "8px 14px" }}>{error}</p>}
    </div>
  );
}

/**
 * Pedir la eliminación de la cuenta. No borra en caliente: crea el pedido y Q
 * Labs lo completa. La confirmación es en la misma pantalla y no un
 * `window.confirm`, que además congela la automatización del navegador.
 */
export function EliminarCuenta({ pedidoEl }: { pedidoEl: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState<EstadoPerfil, FormData>(pedirEliminacionAction, null);

  if (pedidoEl || estado?.ok) {
    return (
      <div className={`${styles.card} ${styles.cardPad}`} style={{ fontSize: 14.5, lineHeight: 1.5 }}>
        <b>Pediste eliminar tu cuenta{pedidoEl ? ` el ${pedidoEl}` : ""}.</b> La completamos en un máximo de cinco
        días hábiles y te avisamos por correo.
      </div>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{ minHeight: 44, width: "100%", color: "var(--risk)", fontWeight: 700, fontSize: 15 }}
      >
        Pedir eliminación de mi cuenta
      </button>
    );
  }

  return (
    <form action={accion} className={`${styles.card} ${styles.cardPad}`} style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>¿Eliminar tu cuenta?</div>
      <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--ink-2)" }}>
        Se borran tus datos y los cupones que no usaste. No se puede deshacer. Mientras lo procesamos no vas a poder
        reclamar cupones nuevos.
      </p>
      <label style={ETIQUETA}>
        ¿Nos contás por qué? (opcional)
        <textarea name="reason" rows={3} maxLength={500} style={{ ...CAMPO, padding: 12, minHeight: 88 }} />
      </label>
      {estado?.error && <p style={{ color: "var(--risk)", fontSize: 14.5 }}>{estado.error}</p>}
      <button
        type="submit"
        disabled={enviando}
        className={styles.btnAplicar}
        style={{ background: "var(--risk)", borderColor: "var(--risk)" }}
      >
        {enviando ? "Enviando…" : "Sí, pedir la eliminación"}
      </button>
      <button type="button" onClick={() => setAbierto(false)} style={{ minHeight: 44, fontWeight: 700, color: "var(--ink-2)" }}>
        Cancelar
      </button>
    </form>
  );
}
