import Link from "next/link";
import FiltroAdmin from "./FiltroAdmin";
import styles from "@/styles/qos.module.css";

export { FiltroAdmin };

export type Pestana = {
  id: string;
  label: string;
  count: number;
  /** La pastilla de "1 pendiente", "2 sin canjear"… Solo se muestra si N > 0. */
  aviso?: { n: number; texto: string };
};

/**
 * Las pestañas de las pantallas de UGC en Q·OS (Marketplace, Loyalty,
 * Disputas). Links y no botones: cambiar de pestaña limpia la búsqueda y el
 * estado, que son de cada pestaña.
 */
export function PestanasAdmin({
  base,
  pestanas,
  activa,
  label,
}: {
  base: string;
  pestanas: Pestana[];
  activa: string;
  label: string;
}) {
  return (
    <nav className={styles.segTabs} aria-label={label}>
      {pestanas.map((p) => (
        <Link
          key={p.id}
          href={`${base}?tab=${p.id}`}
          className={`${styles.segTab} ${activa === p.id ? styles.segTabOn : ""}`}
          aria-current={activa === p.id ? "page" : undefined}
        >
          {p.label}
          <span className={styles.segCount}>{p.count}</span>
          {p.aviso && p.aviso.n > 0 && (
            <span className={styles.segAviso}>
              {p.aviso.n}
              <span className={styles.segAvisoTxt}> {p.aviso.texto}</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Pestañas a la izquierda y filtros a la derecha, en una sola barra. */
export function BarraAdmin({ children }: { children: React.ReactNode }) {
  return <div className={styles.barraAdmin}>{children}</div>;
}

/** La tarjeta de la lista con su "N de M" en el título. */
export function TarjetaLista({
  titulo,
  mostrados,
  total,
  vacio,
  children,
}: {
  titulo: string;
  mostrados: number;
  total: number;
  vacio: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.card} ${styles.cardPad}`}>
      <div className={styles.sectionHead}>
        <h2>
          {titulo} ({mostrados}
          {mostrados !== total ? ` de ${total}` : ""})
        </h2>
      </div>
      {mostrados === 0 ? (
        <div className={styles.empty}>{total === 0 ? vacio : "Nada coincide con ese filtro."}</div>
      ) : (
        children
      )}
    </div>
  );
}
