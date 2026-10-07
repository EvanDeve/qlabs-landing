import Link from "next/link";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export type Pestana = {
  id: string;
  label: string;
  count: number;
  /** "N por verificar", "N abiertas"… Solo se muestra si N > 0. */
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
    <div className={styles.pipeBar} style={{ marginBottom: 16 }}>
      <nav className={`${styles.pipeTabs} ${styles.admTabs}`} aria-label={label}>
        {pestanas.map((p) => (
          <Link
            key={p.id}
            href={`${base}?tab=${p.id}`}
            className={`${styles.pipeTab} ${activa === p.id ? styles.pipeTabOn : ""}`}
            aria-current={activa === p.id ? "page" : undefined}
          >
            <span>{p.label}</span>{" "}
            <span>
              {p.count}
              {p.aviso && p.aviso.n > 0 && (
                <>
                  <span className={styles.tabAvisoLargo}>
                    {" "}
                    · {p.aviso.n} {p.aviso.texto}
                  </span>
                  <span className={styles.tabAvisoCorto}> · {p.aviso.n}</span>
                </>
              )}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/**
 * Buscador + filtro de estado. Un GET de toda la vida: funciona sin JS y la
 * URL dice qué se está mirando.
 */
export function FiltroAdmin({
  base,
  tab,
  q,
  placeholder,
  estado,
  opciones,
  todos = "Todos los estados",
}: {
  base: string;
  tab: string;
  q: string;
  placeholder: string;
  estado?: string | null;
  /** Sin opciones no hay select: solo buscador. */
  opciones?: { id: string; label: string }[];
  todos?: string;
}) {
  return (
    <form method="get" action={base} className={styles.pipeBar} style={{ marginBottom: 16 }}>
      <input type="hidden" name="tab" value={tab} />
      <label className={styles.pipeSearch}>
        <QosIcon name="search" size={14} />
        <input type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label="Buscar" />
      </label>
      {opciones && opciones.length > 0 && (
        <select name="estado" defaultValue={estado ?? ""} className={styles.selectInp} aria-label="Estado">
          <option value="">{todos}</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
        Filtrar
      </button>
      {(q || estado) && (
        <Link href={`${base}?tab=${tab}`} className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
          Limpiar
        </Link>
      )}
    </form>
  );
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
