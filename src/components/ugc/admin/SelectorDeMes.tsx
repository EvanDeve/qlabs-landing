"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * El mes que mira el Pase de servicio.
 *
 * El mes viaja en la URL (`?mes=`) y no en estado del componente para que la
 * pantalla se pueda compartir y para que volver atrás haga lo que se espera. El
 * resto de los parámetros se conservan: si mañana el Dashboard suma otro
 * filtro, cambiar de mes no debería borrarlo.
 */
export default function SelectorDeMes({
  meses,
  actual,
}: {
  // Ya vienen con su etiqueta armada: pasar una función desde un componente de
  // servidor no serializa, y el nombre del mes se resuelve igual allá.
  meses: { valor: string; label: string }[];
  actual: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function cambiar(mes: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", mes);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={actual}
      onChange={(e) => cambiar(e.target.value)}
      aria-label="Mes del Pase de servicio"
      className={styles.inp}
      style={{ width: "auto", textTransform: "capitalize", padding: "6px 10px", fontSize: "13px" }}
    >
      {meses.map((m) => (
        <option key={m.valor} value={m.valor}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
