import styles from "@/styles/qos.module.css";

/**
 * El esqueleto que se ve mientras carga una pantalla del panel.
 *
 * No es decoración: en App Router, un `<Link>` a una ruta dinámica prefetchea
 * solo hasta el `loading.tsx` más cercano, y sin frontera de Suspense el router
 * no puede pintar nada hasta que llega el RSC completo. Sin eso, cada toque
 * dejaba la pantalla vieja congelada los 600-900 ms que tarda el servidor
 * (medido contra producción el 2026-08-20).
 *
 * Va con forma y no con un spinner: un spinner dice "esperá", un esqueleto dice
 * "ya casi". Es genérico a propósito —encabezado y tarjetas— porque un
 * `loading.tsx` cubre todas las pantallas de su segmento, que no tienen la
 * misma forma entre sí.
 */
export default function EsqueletoPanel({ altoTitulo = 34 }: { altoTitulo?: number }) {
  return (
    <div>
      <div className={styles.feedHead}>
        <div className={styles.skBloque} style={{ width: "58%", height: `${altoTitulo}px` }} />
        <div className={styles.skBloque} style={{ width: "76%", height: "14px", marginTop: "10px" }} />
      </div>

      <div className={styles.recLista} style={{ marginTop: "18px" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skTarjeta}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className={styles.skBloque} style={{ width: "44px", height: "44px", borderRadius: "14px" }} />
              <div style={{ flex: 1 }}>
                <div className={styles.skBloque} style={{ width: "62%", height: "15px" }} />
                <div className={styles.skBloque} style={{ width: "40%", height: "12px", marginTop: "7px" }} />
              </div>
            </div>
            <div className={styles.skBloque} style={{ width: "100%", height: "13px" }} />
            <div className={styles.skBloque} style={{ width: "84%", height: "13px" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
