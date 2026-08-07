"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import type { PipelineSection } from "@/lib/database.types";
import { SECCIONES_PIPELINE, SECCION_POR_DEFECTO } from "@/lib/ugc/content-columns";
import { FILTROS_FECHA, type FiltroFecha } from "@/lib/ugc/content-meta";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type Option = { id: string; name: string };

/** Todo lo que la URL dice sobre qué se está mirando. */
export type FiltrosPipeline = {
  brand?: string;
  owner?: string;
  priority?: string;
  fecha: FiltroFecha | null;
  /** Día exacto 'yyyy-MM-dd'. Excluyente con `fecha`. */
  dia: string | null;
  verArchivados: boolean;
  /** Si no hay ningún Hero archivado, la casilla no se dibuja. */
  hayArchivados: boolean;
};

/**
 * La barra de control del tablero, en DOS filas:
 *
 *   1. dónde estoy y qué puedo crear — pestañas + acciones + contador
 *   2. qué estoy recortando — los filtros
 *
 * Antes eran tres (pestañas / filtros / botones) y empujaban las tarjetas media
 * pantalla para abajo. La división no es por tipo de control sino por pregunta:
 * la primera fila no cambia lo que se ve, la segunda sí.
 *
 * Cada select navega solo al cambiar. Se usa router.replace y no un submit de
 * formulario por dos razones: la navegación es del lado del cliente (no recarga
 * la página entera, y el scroll horizontal del Kanban no se pierde) y no ensucia
 * el historial — con push, volver atrás obligaría a deshacer filtro por filtro.
 *
 * useTransition da el estado pendiente mientras el server component vuelve a
 * pedir las piezas; sin eso el tablero queda igual un instante y parece que el
 * click no hizo nada.
 */
export default function PipelineFilters({
  brands,
  staff,
  seccion,
  filtros,
  count,
  busqueda,
  onBusqueda,
  fueraDeLaPestana,
  acciones,
}: {
  brands: Option[];
  staff: Option[];
  /** null = la pestaña "Todo". */
  seccion: PipelineSection | null;
  filtros: FiltrosPipeline;
  /** Tarjetas realmente en pantalla. Lo cuenta KanbanBoard, que aplica la búsqueda. */
  count: number;
  /**
   * El buscador NO viaja en la URL como el resto de los filtros: filtra en el
   * navegador sobre las piezas ya cargadas. Por eso su estado vive en
   * KanbanBoard y llega hasta acá por props.
   */
  busqueda: string;
  onBusqueda: (valor: string) => void;
  /** Cuántas coincidencias quedaron en la otra pestaña. 0 si no hay que avisar. */
  fueraDeLaPestana: number;
  /** "Nueva pieza" / "Nueva columna": viven en KanbanBoard, que tiene su estado. */
  acciones: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { brand, owner, priority, fecha, dia, verArchivados, hayArchivados } = filtros;

  /**
   * Escribe filtros en la URL. Acepta varias claves de una para poder aplicar
   * y limpiar en la MISMA navegación: el preset de fecha y el día exacto son
   * excluyentes, y hacerlo en dos llamadas dejaría un instante con los dos
   * puestos —y una consulta de más que devuelve vacío—.
   */
  function setFilters(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(cambios)) {
      // Un filtro vacío se borra del query en vez de quedar como `?brand=`: así
      // la URL que se comparte o se marca dice exactamente qué está filtrado.
      if (value) params.set(key, value);
      else params.delete(key);
    }

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  const setFilter = (key: string, value: string) => setFilters({ [key]: value });

  return (
    <div style={{ opacity: isPending ? 0.6 : 1 }}>
      <div className={styles.pipeBar}>
        {/* Botones y no <Link>: los filtros activos viajan en el query y un href
            fijo los borraría. Misma razón por la que todo acá pasa por setFilter. */}
        <div className={styles.pipeTabs}>
          {SECCIONES_PIPELINE.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilter("seccion", s.id === SECCION_POR_DEFECTO ? "" : s.id)}
              className={`${styles.btn} ${styles.btnSm} ${seccion === s.id ? styles.btnPrimary : styles.btnGhost}`}
              aria-current={seccion === s.id ? "page" : undefined}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilter("seccion", "todo")}
            className={`${styles.btn} ${styles.btnSm} ${seccion === null ? styles.btnPrimary : styles.btnGhost}`}
            aria-current={seccion === null ? "page" : undefined}
          >
            Todo
          </button>
        </div>

        <div className={styles.pipeBarEnd}>
          {acciones}
          <span className={styles.chip}>
            {busqueda
              ? `${count} ${count === 1 ? "coincidencia" : "coincidencias"}`
              : `${count} piezas en flujo`}
          </span>
        </div>
      </div>

      <div className={styles.pipeBar}>
        {/* Va primero de la fila porque es lo que más se usa: buscar una pieza
            por su nombre es la pregunta de todos los días; los selects recortan
            el tablero, que se hace mucho menos seguido.

            No hay debounce ni botón: filtra sobre lo que ya está en memoria, así
            que responde en la misma tecla. */}
        <div className={styles.pipeSearch}>
          <QosIcon name="search" size={14} />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código…"
            aria-label="Buscar una pieza por nombre o código"
          />
          {busqueda && (
            <button type="button" onClick={() => onBusqueda("")} aria-label="Limpiar la búsqueda">
              <QosIcon name="x" size={13} />
            </button>
          )}
        </div>

        {/* Sin esto, buscar algo que vive en la otra pestaña se ve igual que
            buscar algo que no existe, y la respuesta correcta —cambiá de
            pestaña— no está en ningún lado. */}
        {fueraDeLaPestana > 0 && (
          <button
            type="button"
            onClick={() => setFilter("seccion", "todo")}
            className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
          >
            {fueraDeLaPestana} en la otra pestaña — ver todo
          </button>
        )}

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

        {/* Preset y día exacto son dos formas de la MISMA pregunta, así que se
            limpian entre sí: elegir un preset borra el día y viceversa. Van
            pegados —con la etiqueta "o el día" en el medio— para que se lean
            como un control con dos entradas y no como dos filtros que se suman. */}
        <select
          value={fecha ?? ""}
          onChange={(e) => setFilters({ fecha: e.target.value, dia: "" })}
          className={styles.selectInp}
          aria-label="Filtrar por fecha de publicación"
        >
          <option value="">Cualquier fecha</option>
          {FILTROS_FECHA.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>

        <span className={styles.pipeSep}>o el día</span>

        <input
          type="date"
          value={dia ?? ""}
          onChange={(e) => setFilters({ dia: e.target.value, fecha: "" })}
          className={styles.selectInp}
          aria-label="Publica un día exacto"
        />

        {dia && (
          <button
            type="button"
            onClick={() => setFilter("dia", "")}
            className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
          >
            Quitar el día
          </button>
        )}

        <div className={styles.pipeBarEnd}>
          {/* Solo aparece si hay algo que mostrar: una casilla que nunca cambia
              nada es ruido permanente en la barra. */}
          {hayArchivados && (
            <label className={styles.pipeCheck}>
              <input
                type="checkbox"
                checked={verArchivados}
                onChange={(e) => setFilter("archivados", e.target.checked ? "1" : "")}
              />
              Ver Heroes archivados
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
