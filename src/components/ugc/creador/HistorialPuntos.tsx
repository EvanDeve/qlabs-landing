import styles from "@/styles/qos.module.css";

export type FilaHistorial = {
  id: string;
  titulo: string;
  detalle: string;
  /** Null cuando la fila no mueve puntos (un cupón reclamado, un hito). */
  puntos: number | null;
  etiqueta: string | null;
  esHito: boolean;
};

export type MesHistorial = {
  clave: string;
  titulo: string;
  total: number;
  filas: FilaHistorial[];
};

export type NivelCamino = {
  level: number;
  name: string;
  alcanzado: boolean;
  esActual: boolean;
};

export type ReglaPuntos = {
  action: string;
  label: string;
  points: number;
  limite: string;
};

/**
 * El historial: el camino de niveles arriba y abajo el ledger agrupado por mes.
 *
 * Sin hooks a propósito: lo monta `RecompensasTabs`, que sí es cliente, pero
 * esto es solo forma. Todo lo que decide qué fila existe —incluidos los hitos
 * de nivel, que se deducen del acumulado— se calcula en el servidor.
 */
export default function HistorialPuntos({
  camino,
  meses,
  reglas,
  totalEventos,
  mostrados,
}: {
  camino: NivelCamino[];
  meses: MesHistorial[];
  reglas: ReglaPuntos[];
  totalEventos: number;
  mostrados: number;
}) {
  const ultimo = Math.max(1, camino.length - 1);
  const indiceActual = camino.findIndex((n) => n.esActual);
  const fracActual = Math.max(0, indiceActual) / ultimo;

  return (
    <>
      <div className={styles.recCard}>
        <div className={styles.recPuntosLabel}>Tu camino de niveles</div>
        <div className={styles.nivelesTrack}>
          <div className={styles.nivelesLinea}>
            <div className={styles.nivelesLineaFill} style={{ width: `${fracActual * 100}%` }} />
          </div>
          {camino.map((n, i) => (
            <span
              key={n.level}
              className={`${styles.nivelDot} ${n.esActual ? styles.nivelDotActual : ""}`}
              style={{ left: `calc(9px + (100% - 18px) * ${i / ultimo})` }}
              title={n.name}
            />
          ))}
        </div>
        <div className={styles.nivelLabels}>
          {camino.map((n) => (
            <span key={n.level} style={n.esActual ? { color: "var(--ink)", fontWeight: 700 } : undefined}>
              {n.name}
            </span>
          ))}
        </div>
      </div>

      {meses.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`} style={{ marginTop: "22px" }}>
          Todavía no sumaste puntos. Completá tu perfil, subí piezas al book y aplicá a promos para
          arrancar.
        </div>
      ) : (
        meses.map((mes) => (
          <div key={mes.clave}>
            <div className={styles.mesHead}>
              {mes.titulo}
              {mes.total > 0 && ` · +${mes.total.toLocaleString("es-CR")} pts`}
            </div>
            <div className={styles.histCard}>
              {mes.filas.map((f) => (
                <div key={f.id} className={styles.histFila}>
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.histTitulo}>{f.titulo}</div>
                    <div className={styles.histDetalle}>{f.detalle}</div>
                  </div>
                  {f.puntos !== null ? (
                    <span className={styles.histPuntos}>+{f.puntos}</span>
                  ) : (
                    <span className={`${styles.histPill} ${f.esHito ? styles.histPillHito : ""}`}>
                      {f.etiqueta}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {totalEventos > mostrados && (
        <p className={styles.cuponNota} style={{ marginTop: "12px" }}>
          Mostrando los últimos {mostrados} movimientos de {totalEventos}.
        </p>
      )}

      {/* Las reglas van al final del historial y no en una pantalla aparte: es
          donde el creador está mirando qué le sumó puntos y preguntándose qué
          más suma. Salen de `point_rules`, no de una tabla escrita a mano. */}
      <div className={styles.mesHead} style={{ marginTop: "26px" }}>
        Cómo se ganan puntos
      </div>
      <div className={styles.histCard}>
        {reglas.map((r) => (
          <div key={r.action} className={styles.histFila}>
            <div style={{ minWidth: 0 }}>
              <div className={styles.histTitulo}>{r.label}</div>
              <div className={styles.histDetalle}>{r.limite}</div>
            </div>
            <span className={styles.histPuntos}>+{r.points}</span>
          </div>
        ))}
      </div>
      <p className={styles.cuponNota} style={{ marginTop: "10px" }}>
        Los límites mensuales existen para que el nivel refleje trabajo entregado. Lo que pase del
        tope sigue contando para tu book, pero no suma puntos ese mes.
      </p>
    </>
  );
}
