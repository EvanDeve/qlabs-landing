"use client";

import { useState, useTransition } from "react";
import { sembrarColumnasSugeridasAction } from "@/lib/actions/creator-tasks";
import { COLUMNAS_SUGERIDAS } from "@/lib/ugc/creator-task";
import ColumnModal from "@/components/ugc/creador/ColumnModal";
import styles from "@/styles/qos.module.css";

/**
 * La primera visita al pipeline, cuando todavía no hay ninguna columna.
 *
 * Existe porque antes el tablero se sembraba solo y esta pantalla nunca
 * aparecía: con ella se gana el único momento para decir dos cosas que después
 * ya no se dicen en ninguna parte —que las columnas son suyas y que nadie más
 * ve este tablero—. Quien no quiera decidir nada toca "Usar columnas
 * sugeridas" y sigue como antes.
 */
export default function TableroVacio() {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creandoColumna, setCreandoColumna] = useState(false);

  function sembrar() {
    setError(null);
    startTransition(async () => {
      const res = await sembrarColumnasSugeridasAction();
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <>
      <div className={styles.vacioCard}>
        <h2 className={styles.vacioTitulo}>Armá tu tablero</h2>
        <p className={styles.vacioTexto}>
          Las columnas son tuyas: ponelas como trabajás vos. Nadie más ve este tablero.
        </p>
        <button type="button" className={styles.vacioCta} onClick={sembrar} disabled={pendiente}>
          {pendiente ? "Creando…" : "+ Usar columnas sugeridas"}
        </button>
        <button
          type="button"
          className={styles.vacioCtaSuave}
          onClick={() => setCreandoColumna(true)}
          disabled={pendiente}
        >
          Crear la mía
        </button>
        {error && <p className={styles.entError}>{error}</p>}
      </div>

      <h3 className={styles.vacioSeccion}>Sugeridas para UGC</h3>
      <div className={styles.vacioLista}>
        {COLUMNAS_SUGERIDAS.map((c) => (
          <div key={c.name} className={styles.vacioFila}>
            <span className={styles.vacioPunto} style={{ background: c.color }} aria-hidden />
            <div>
              <div className={styles.vacioNombre}>
                {c.name}
                {c.is_done && <span className={styles.vacioBadge}>Terminadas</span>}
              </div>
              <div className={styles.vacioQue}>{c.que}</div>
            </div>
          </div>
        ))}
      </div>

      {creandoColumna && (
        <ColumnModal
          column={null}
          totalColumns={0}
          taskCount={0}
          isOnlyDoneColumn={false}
          onClose={() => setCreandoColumna(false)}
        />
      )}
    </>
  );
}
