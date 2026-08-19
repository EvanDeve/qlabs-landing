"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { mesCR } from "@/lib/ugc/cronograma";
import styles from "@/styles/qos.module.css";

/** La única pantalla que mira un mes. Fuera de acá el control no significa nada. */
const RUTA = "/admin";

/**
 * El mes que mira el Dashboard, en la barra superior.
 *
 * Vive en el shell y no dentro de la tarjeta de "Estado de las cuentas" porque
 * es el encuadre de la pantalla, no un filtro de una sección: decide de qué mes
 * se está hablando. Arriba, al lado de la campanita, se lee antes de mirar los
 * números y no después.
 *
 * Se esconde solo en el resto del panel. El shell lo renderiza siempre —lo pasa
 * el layout, que no sabe en qué página está— así que la decisión la toma este
 * componente, que sí conoce la ruta. La alternativa era un portal desde la
 * página, que obliga a un setState de arranque para esperar al DOM.
 *
 * El mes viaja en la URL (`?mes=`) y no en estado: así la pantalla se puede
 * compartir y volver atrás hace lo que se espera. El resto de los parámetros se
 * conservan.
 */
export default function SelectorDeMes() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname !== RUTA) return null;

  // Sin `?mes=` el Dashboard muestra el mes actual, así que el control tiene
  // que decir lo mismo. `mesCR` lo resuelve en hora de Costa Rica —también en
  // el navegador— y devuelve 'yyyy-MM-01'; el input quiere 'yyyy-MM'.
  const actual = (searchParams.get("mes") ?? mesCR()).slice(0, 7);

  function cambiar(mes: string) {
    const params = new URLSearchParams(searchParams.toString());
    // Un input de mes se puede vaciar: sin valor se vuelve al mes actual, que
    // es el default del Dashboard. Dejar `?mes=` vacío haría que el parseo lo
    // rechace y muestre el actual igual, pero con una URL sucia.
    if (mes) params.set("mes", `${mes}-01`);
    else params.delete("mes");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className={styles.tbMes}>
      <span>Mes</span>
      <input
        type="month"
        value={actual}
        onChange={(e) => cambiar(e.target.value)}
        aria-label="Mes del Pase de servicio"
      />
    </label>
  );
}
