"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type Option = { id: string; name: string };

/**
 * Filtros del pipeline. Antes eran un <form method="get"> con botón "Filtrar":
 * había que elegir en el select y recién después apretar el botón, así que un
 * cambio de Hero costaba dos clics y era fácil creer que ya estaba filtrado
 * cuando no lo estaba.
 *
 * Ahora cada select navega solo al cambiar. Se usa router.replace y no un
 * submit de formulario por dos razones: la navegación es del lado del cliente
 * (no recarga la página entera, y el scroll horizontal del Kanban no se pierde)
 * y no ensucia el historial — con push, volver atrás obligaría a deshacer
 * filtro por filtro.
 *
 * useTransition da el estado pendiente mientras el server component vuelve a
 * pedir las piezas; sin eso el tablero queda igual un instante y parece que el
 * click no hizo nada.
 */
export default function PipelineFilters({
  brands,
  staff,
  brand,
  owner,
  priority,
  count,
}: {
  brands: Option[];
  staff: Option[];
  brand?: string;
  owner?: string;
  priority?: string;
  count: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    // Un filtro vacío se borra del query en vez de quedar como `?brand=`: así
    // la URL que se comparte o se marca dice exactamente qué está filtrado.
    if (value) params.set(key, value);
    else params.delete(key);

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className={styles.pipeToolbar} style={{ opacity: isPending ? 0.6 : 1 }}>
      <select
        value={brand ?? ""}
        onChange={(e) => setFilter("brand", e.target.value)}
        className={styles.selectInp}
        aria-label="Filtrar por Hero"
      >
        <option value="">Todos los Heroes</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <select
        value={owner ?? ""}
        onChange={(e) => setFilter("owner", e.target.value)}
        className={styles.selectInp}
        aria-label="Filtrar por responsable"
      >
        <option value="">Todos los responsables</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        value={priority ?? ""}
        onChange={(e) => setFilter("priority", e.target.value)}
        className={styles.selectInp}
        aria-label="Filtrar por prioridad"
      >
        <option value="">Toda prioridad</option>
        <option value="alta">Alta</option>
        <option value="media">Media</option>
        <option value="baja">Baja</option>
      </select>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
        <span className={styles.chip}>{count} piezas en flujo</span>
      </div>
    </div>
  );
}
