"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export type OpcionFiltro = {
  id: string;
  label: string;
  /** Punto de color a la izquierda — el del Hero, el de la prioridad. */
  color?: string;
};

/**
 * Un filtro del tablero: una pastilla que dice qué filtra y por qué valor, y
 * abre su propia lista.
 *
 * Reemplaza a un `<select>` nativo, que no dejaba dos cosas que el tablero
 * necesita: la etiqueta adentro del control ("Hero · Todos", en vez de una
 * palabra suelta antes de cada campo, que duplicaba el ancho de la fila) y el
 * punto de color de cada Hero, que es como el equipo los reconoce en las
 * tarjetas.
 *
 * Cierra al tocar afuera con un listener en `document` y NO con el fondo
 * invisible a pantalla completa que usa la campana. Acá hay cuatro de estos
 * pegados: con un fondo de por medio, el clic en la pastilla de al lado se lo
 * come el fondo —cierra el panel abierto y nada más—, así que pasar de "Hero" a
 * "Fecha" costaba dos clics en vez de uno.
 */
export default function FiltroDropdown({
  label,
  valorLabel,
  activo,
  opciones,
  seleccionado,
  onElegir,
  pie,
}: {
  label: string;
  /** Lo que se lee en la pastilla: "Todos", "Zonna Gastrobar", "14 ago". */
  valorLabel: string;
  /** Si está recortando el tablero. Pinta la pastilla. */
  activo: boolean;
  opciones: OpcionFiltro[];
  /** id de la opción elegida; "" es la primera ("Todos"). */
  seleccionado: string;
  onElegir: (id: string) => void;
  /** Control extra al fondo del panel — hoy, el día exacto del filtro de fecha. */
  pie?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Afuera cierra, y Escape también: sin la tecla, abierto el panel, la única
  // salida es el mouse.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className={styles.filtroWrap} ref={wrap}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${styles.filtroBtn} ${activo ? styles.filtroBtnOn : ""} ${
          open ? styles.filtroBtnOpen : ""
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={styles.filtroBtnLabel}>{label}</span>
        <span className={styles.filtroBtnValor}>{valorLabel}</span>
        {/* El set de íconos no tiene chevron hacia abajo: es el de la derecha,
            girado. Uno solo, girado, pesa menos que un ícono nuevo. */}
        <span
          className={styles.filtroBtnChev}
          style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 140ms" }}
        >
          <QosIcon name="chevR" size={13} />
        </span>
      </button>

      {open && (
        <div className={styles.filtroPanel} role="listbox" aria-label={label}>
          {opciones.map((o) => (
            <button
              key={o.id || "todos"}
              type="button"
              role="option"
              aria-selected={o.id === seleccionado}
              onClick={() => {
                onElegir(o.id);
                setOpen(false);
              }}
              className={`${styles.filtroOpt} ${o.id === seleccionado ? styles.filtroOptOn : ""}`}
            >
              {o.color && <span className={styles.filtroDot} style={{ background: o.color }} />}
              {o.label}
              {o.id === seleccionado && (
                <span className={styles.filtroCheck}>
                  <QosIcon name="check" size={14} />
                </span>
              )}
            </button>
          ))}
          {pie && <div className={styles.filtroPanelPie}>{pie}</div>}
        </div>
      )}
    </div>
  );
}
