import type { CSSProperties } from "react";
import styles from "@/styles/qos.module.css";

type Props = {
  /** Ancho: número en px o cualquier valor CSS. Por defecto ocupa todo. */
  w?: number | string;
  /** Alto en px o valor CSS. 12 = una línea de texto chico. */
  h?: number | string;
  circle?: boolean;
  /** Radio propio (un ícono cuadrado, una tarjeta). Si no, el de .skel. */
  r?: number | string;
  style?: CSSProperties;
};

/**
 * Un bloque gris que late. Es la única pieza de los loading.tsx: la silueta
 * de cada pantalla se arma poniendo varios de estos adentro de las clases
 * estructurales reales de esa pantalla (ver .skel en qos.module.css).
 */
export function Skel({ w = "100%", h = 12, circle, r, style }: Props) {
  return (
    <div
      aria-hidden
      className={`${styles.skel} ${circle ? styles.skelCircle : ""}`}
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

/** Varias líneas de texto, con la última más corta como un párrafo real. */
export function SkelLineas({ n = 3, h = 11, gap = 9 }: { n?: number; h?: number; gap?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: n }, (_, i) => (
        <Skel key={i} h={h} w={i === n - 1 ? "58%" : i % 2 ? "88%" : "100%"} />
      ))}
    </div>
  );
}

/**
 * La raíz de todo loading.tsx: le dice al lector de pantalla que está
 * cargando y esconde la silueta, que es decoración.
 */
export function SkelPantalla({ children, className, style }: { children: React.ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando" className={className} style={style}>
      {children}
    </div>
  );
}
