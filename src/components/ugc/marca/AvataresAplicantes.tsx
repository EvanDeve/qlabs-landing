import styles from "@/styles/qos.module.css";

export type CaraAplicante = { id: string; nombre: string; avatarUrl: string | null };

/** Las iniciales que se dibujan cuando no hay foto: "Vale Mora" → "VM". */
function iniciales(nombre: string): string {
  const partes = nombre.replace(/^@/, "").split(/[\s._-]+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/**
 * Los colores van por POSICIÓN y no por hash del id.
 *
 * El hash fue el primer intento en el Pipeline de Q·OS y falló medido: los
 * UUID de Postgres comparten demasiada estructura y once personas caían en
 * seis colores. Con dos o tres caras el problema sería peor todavía.
 */
const COLORES = ["#7b63f5", "#3aa981", "#e08a2c", "#3b6ef5", "#c25ab8"];

export default function AvataresAplicantes({
  caras,
  max = 3,
}: {
  caras: CaraAplicante[];
  /** Cuántas caras se dibujan antes de resumir en "+N". */
  max?: number;
}) {
  if (caras.length === 0) return null;
  const visibles = caras.slice(0, max);
  const resto = caras.length - visibles.length;

  return (
    <div className={styles.mcAvatars}>
      {visibles.map((c, i) => (
        <span
          key={c.id}
          className={styles.mcAvatar}
          style={{ background: c.avatarUrl ? undefined : COLORES[i % COLORES.length] }}
          title={c.nombre}
        >
          {c.avatarUrl ? (
            // viven en Storage y son de 40px: `next/image` acá suma un
            // optimizador que no cambia nada y obliga a declarar el dominio.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatarUrl} alt="" />
          ) : (
            iniciales(c.nombre)
          )}
        </span>
      ))}
      {resto > 0 && (
        <span className={`${styles.mcAvatar} ${styles.mcAvatarMas}`}>+{resto}</span>
      )}
    </div>
  );
}
