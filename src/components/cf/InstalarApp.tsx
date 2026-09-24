"use client";

import { useState, useSyncExternalStore } from "react";
import { CF } from "@/lib/cf/copy";
import styles from "@/styles/qos.module.css";

/**
 * "Guardá Close Friends en tu inicio".
 *
 * Tres casos, porque cada teléfono lo resuelve distinto:
 *
 *   · ya instalada (se abrió desde el ícono) → no se muestra nada;
 *   · Android/Chrome → Chrome ofrece instalarla con `beforeinstallprompt`, y
 *     el botón abre ese diálogo nativo;
 *   · iPhone → Apple no deja ofrecer un botón: se explica el camino
 *     (Compartir → Agregar a inicio).
 *
 * ⚠️ En iPhone la app instalada NO comparte la sesión con Safari: al abrirla la
 * primera vez pide el correo y el código una vez. Se avisa acá para que no se
 * lo tome como que se borró la cuenta.
 */

type Plataforma = "servidor" | "instalada" | "ios" | "otra";

/** El evento de Chrome, que TypeScript no trae tipado. */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// El evento llega UNA vez, cuando Chrome decide que la app es instalable —a
// veces antes de que este componente monte—, así que se escucha a nivel módulo.
let eventoInstalar: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalar = e as EventoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    eventoInstalar = null;
    oyentes.forEach((f) => f());
  });
}
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

function plataforma(): Plataforma {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "instalada";
  // iPadOS se anuncia como Mac: se lo distingue por la pantalla táctil.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "otra";
}

const CLAVE_CERRADA = "cf-instalar-cerrada";
function leerCerrada(): boolean {
  try {
    return localStorage.getItem(CLAVE_CERRADA) === "1";
  } catch {
    return false;
  }
}

export default function InstalarApp() {
  const donde = useSyncExternalStore(suscribir, plataforma, () => "servidor" as Plataforma);
  const hayBoton = useSyncExternalStore(suscribir, () => eventoInstalar !== null, () => false);
  const cerradaAntes = useSyncExternalStore(suscribir, leerCerrada, () => true);
  const [cerrada, setCerrada] = useState(false);

  if (donde === "servidor" || donde === "instalada" || cerrada || cerradaAntes) return null;

  const cerrar = () => {
    setCerrada(true);
    try {
      localStorage.setItem(CLAVE_CERRADA, "1");
    } catch {
      // Sin almacenamiento (modo privado): se cierra solo por esta visita.
    }
  };

  return (
    <section className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 16, position: "relative" }}>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar"
        style={{ position: "absolute", top: 6, right: 6, width: 44, height: 44, display: "grid", placeItems: "center", color: "var(--ink-2)" }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <div style={{ fontWeight: 800, fontSize: 17, paddingRight: 36 }}>Guardá {CF.programa} en tu inicio</div>
      <p style={{ fontSize: 14.5, lineHeight: 1.45, color: "var(--ink-2)", marginTop: 6 }}>
        Queda como una app: la abrís de un toque para mostrar tus cupones en caja.
      </p>

      {hayBoton ? (
        <button
          type="button"
          className={styles.btnAplicar}
          style={{ marginTop: 14 }}
          onClick={async () => {
            await eventoInstalar?.prompt();
            eventoInstalar = null;
          }}
        >
          Instalar app
        </button>
      ) : donde === "ios" ? (
        <>
          <ol style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            <Paso n={1}>
              Tocá <b>Compartir</b>{" "}
              <IconoCompartir /> en la barra de Safari.
            </Paso>
            <Paso n={2}>
              Elegí <b>Agregar a inicio</b>.
            </Paso>
            <Paso n={3}>
              Abrila desde el ícono. <b>La primera vez te pedimos tu correo</b> otra vez: es normal.
            </Paso>
          </ol>
        </>
      ) : (
        <ol style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
          <Paso n={1}>
            Abrí el menú del navegador <b>⋮</b>.
          </Paso>
          <Paso n={2}>
            Elegí <b>Agregar a pantalla principal</b> o <b>Instalar app</b>.
          </Paso>
        </ol>
      )}
    </section>
  );
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, lineHeight: 1.4 }}>
      <span
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: 999,
          background: "#ECE7FB",
          color: "#5641D8",
          fontWeight: 800,
          fontSize: 13,
          display: "grid",
          placeItems: "center",
        }}
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** El ícono de Compartir de iOS: cuadrado con flecha hacia arriba. */
function IconoCompartir() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#1E7BF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-3px" }} aria-label="Compartir">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}
