"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "@/styles/qos.module.css";

export type ItemMenu =
  | { tipo: "link"; label: string; href: string; externo?: boolean }
  | { tipo: "copiar"; label: string; texto: string }
  | {
      tipo: "accion";
      label: string;
      action: (formData: FormData) => void | Promise<void>;
      campos: Record<string, string>;
      peligro?: boolean;
    };

/**
 * El "⋯" de una fila (mockup 1b): lo que no es la acción principal de la fila
 * va acá, para que cada fila muestre UNA sola cosa a la vista.
 *
 * Las acciones son los mismos server actions que usan los botones de siempre,
 * con sus campos ocultos; el menú solo cambia dónde se tocan. Sin
 * window.confirm(): congela la automatización del navegador.
 */
export default function MenuFila({ items, label = "Más acciones" }: { items: ItemMenu[]; label?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  if (items.length === 0) return null;

  // Las de peligro van al final, separadas: "Quitar verificación" no tiene que
  // quedar pegado a "Ver book".
  const normales = items.filter((i) => !(i.tipo === "accion" && i.peligro));
  const peligrosas = items.filter((i) => i.tipo === "accion" && i.peligro);

  const render = (item: ItemMenu) => {
    if (item.tipo === "link") {
      return item.externo ? (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.menuFilaItem}
          role="menuitem"
        >
          {item.label}
        </a>
      ) : (
        <Link key={item.label} href={item.href} className={styles.menuFilaItem} role="menuitem">
          {item.label}
        </Link>
      );
    }
    if (item.tipo === "copiar") {
      return (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={styles.menuFilaItem}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(item.texto);
              setCopiado(true);
              setTimeout(() => {
                setCopiado(false);
                setAbierto(false);
              }, 900);
            } catch {
              setAbierto(false);
            }
          }}
        >
          {copiado ? "Copiado ✓" : item.label}
        </button>
      );
    }
    return (
      <form key={item.label} action={item.action} onSubmit={() => setAbierto(false)}>
        {Object.entries(item.campos).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <button
          type="submit"
          role="menuitem"
          className={`${styles.menuFilaItem} ${item.peligro ? styles.menuFilaPeligro : ""}`}
        >
          {item.label}
        </button>
      </form>
    );
  };

  return (
    <div ref={raiz} className={styles.menuFila}>
      <button
        type="button"
        className={styles.menuFilaBtn}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        ⋯
      </button>
      {abierto && (
        <div className={styles.menuFilaPanel} role="menu">
          {normales.map(render)}
          {peligrosas.length > 0 && normales.length > 0 && <div className={styles.menuFilaSep} />}
          {peligrosas.map(render)}
        </div>
      )}
    </div>
  );
}
