"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import type { PipelineSection } from "@/lib/database.types";
import { SECCIONES_PIPELINE, SECCION_POR_DEFECTO } from "@/lib/ugc/content-columns";
import { CONTENT_PRIORITY_DOT, FILTROS_FECHA, type FiltroFecha } from "@/lib/ugc/content-meta";
import { diaCorto } from "@/lib/ugc/calendar";
import { QosIcon } from "@/lib/ugc/qos-icons";
import FiltroDropdown from "@/components/ugc/admin/FiltroDropdown";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type Option = { id: string; name: string; color?: string };

/** Todo lo que la URL dice sobre qué se está mirando. */
export type FiltrosPipeline = {
  brand?: string;
  owner?: string;
  priority?: string;
  fecha: FiltroFecha | null;
  /** Día exacto 'yyyy-MM-dd'. Excluyente con `fecha`. */
  dia: string | null;
  verArchivados: boolean;
  /** Si no hay ningún Hero archivado, el interruptor no se dibuja. */
  hayArchivados: boolean;
};

/**
 * La barra de control del tablero, en DOS filas:
 *
 *   1. dónde estoy, qué busco y qué puedo crear — pestañas + buscador +
 *      contador + acciones
 *   2. qué estoy recortando — los filtros, detrás del rótulo "Filtros"
 *
 * Antes eran tres (pestañas / filtros / botones) y empujaban las tarjetas media
 * pantalla para abajo. La división no es por tipo de control sino por pregunta:
 * la primera fila no cambia QUÉ piezas hay, solo cuáles miro y cómo las
 * encuentro; la segunda sí las recorta.
 *
 * El buscador vive arriba, con las pestañas, y no entre los filtros: no filtra
 * contra la base como ellos —trabaja sobre lo que ya está cargado— y es lo que
 * más se usa, así que no tiene que competir por lugar con cuatro controles que
 * se tocan mucho menos.
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
  /** "Nueva pieza": vive en KanbanBoard, que tiene su estado. */
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

  // Lo que se lee en cada pastilla con el panel cerrado. Un filtro puesto tiene
  // que decir SU valor —"Zonna Gastrobar", no "Hero"—, que es lo que hace que se
  // note que el tablero está recortado sin abrir nada.
  const nombreDe = (lista: Option[], id?: string) => lista.find((o) => o.id === id)?.name;
  const labelFecha = dia
    ? diaCorto(dia)
    : (FILTROS_FECHA.find((f) => f.id === fecha)?.label ?? "Cualquiera");

  // Cuántas pastillas están recortando el tablero. El botón de limpiar aparece
  // solo si hay alguna: un "Limpiar filtros" que nunca hace nada es ruido fijo,
  // y además el hueco que deja al desaparecer no mueve nada —va al final de la
  // fila, después de la última pastilla.
  const puestos = [brand, owner, priority, fecha, dia].filter(Boolean).length;
  // `archivados` NO entra, aunque viva en la misma fila: es el único control que
  // AGREGA piezas en vez de sacarlas. Quien toca "limpiar" quiere ver más, así
  // que apagarle el interruptor haría justo lo contrario.
  // La búsqueda tampoco: vive en la otra fila y su texto queda a la vista, así
  // que borrarla desde acá sería una desaparición sin causa visible.
  const limpiarFiltros = () =>
    setFilters({ brand: "", owner: "", priority: "", fecha: "", dia: "" });

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
              className={`${styles.pipeTab} ${seccion === s.id ? styles.pipeTabOn : ""}`}
              aria-current={seccion === s.id ? "page" : undefined}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilter("seccion", "todo")}
            className={`${styles.pipeTab} ${seccion === null ? styles.pipeTabOn : ""}`}
            aria-current={seccion === null ? "page" : undefined}
          >
            Todo
          </button>
        </div>

        {/* No hay debounce ni botón: filtra sobre lo que ya está en memoria, así
            que responde en la misma tecla. */}
        <div className={styles.pipeSearch}>
          <QosIcon name="search" size={14} />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder="Nombre o código…"
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
            {/* "la otra pestaña" se escribió cuando el tablero tenía dos
                secciones; con IT ya son tres y la frase dejó de ser cierta. */}
            {fueraDeLaPestana} en otras pestañas — ver todo
          </button>
        )}

        <div className={styles.pipeBarEnd}>
          <span className={styles.chip}>
            {busqueda
              ? `${count} ${count === 1 ? "coincidencia" : "coincidencias"}`
              : `${count} piezas en flujo`}
          </span>
          {acciones}
        </div>
      </div>

      <div className={styles.pipeBar}>
        <span className={styles.pipeFiltersTag}>
          <QosIcon name="menu" size={13} />
          Filtros
        </span>

        <FiltroDropdown
          label="Hero"
          valorLabel={nombreDe(brands, brand) ?? "Todos"}
          activo={Boolean(brand)}
          seleccionado={brand ?? ""}
          onElegir={(id) => setFilter("brand", id)}
          opciones={[
            { id: "", label: "Todos" },
            ...brands.map((b) => ({ id: b.id, label: b.name, color: b.color })),
          ]}
        />

        <FiltroDropdown
          label="Responsable"
          valorLabel={nombreDe(staff, owner) ?? "Todos"}
          activo={Boolean(owner)}
          seleccionado={owner ?? ""}
          onElegir={(id) => setFilter("owner", id)}
          opciones={[{ id: "", label: "Todos" }, ...staff.map((s) => ({ id: s.id, label: s.name }))]}
        />

        <FiltroDropdown
          label="Prioridad"
          valorLabel={priority ? priority[0].toUpperCase() + priority.slice(1) : "Toda"}
          activo={Boolean(priority)}
          seleccionado={priority ?? ""}
          onElegir={(id) => setFilter("priority", id)}
          opciones={[
            { id: "", label: "Toda" },
            { id: "alta", label: "Alta", color: CONTENT_PRIORITY_DOT.alta },
            { id: "media", label: "Media", color: CONTENT_PRIORITY_DOT.media },
            { id: "baja", label: "Baja", color: CONTENT_PRIORITY_DOT.baja },
          ]}
        />

        {/* Preset y día exacto son la MISMA pregunta, así que viven en UN control
            y se limpian entre sí: elegir uno borra el otro. Combinarlos daría
            cosas como "atrasadas Y el 10 de agosto", que casi siempre es el
            conjunto vacío y se lee como que el tablero se rompió.
            (Hubo un tercero, "o el mes", hasta el 2026-08-14: lo sacó Evan por
            repetir a "Publica este mes", que es la pregunta que sí se hace.) */}
        <FiltroDropdown
          label="Fecha"
          valorLabel={labelFecha}
          activo={Boolean(fecha || dia)}
          seleccionado={dia ? "__dia" : (fecha ?? "")}
          onElegir={(id) => setFilters({ fecha: id, dia: "" })}
          opciones={[
            { id: "", label: "Cualquiera" },
            ...FILTROS_FECHA.map((f) => ({ id: f.id, label: f.label })),
          ]}
          pie={
            <>
              <label htmlFor="pipe-dia">O un día exacto</label>
              <input
                id="pipe-dia"
                type="date"
                value={dia ?? ""}
                onChange={(e) => setFilters({ dia: e.target.value, fecha: "" })}
              />
            </>
          }
        />

        {/* Dice CUÁNTOS limpia, y no solo "Limpiar": con el tablero vacío, el
            número es lo que explica por qué está vacío sin abrir una pastilla. */}
        {puestos > 0 && (
          <button type="button" onClick={limpiarFiltros} className={styles.filtroLimpiar}>
            <QosIcon name="x" size={12} />
            Limpiar {puestos === 1 ? "el filtro" : `los ${puestos} filtros`}
          </button>
        )}

        <div className={styles.pipeBarEnd}>
          {/* Solo aparece si hay algo que mostrar: un interruptor que nunca
              cambia nada es ruido permanente en la barra. */}
          {hayArchivados && (
            <label className={styles.switchCheck}>
              <input
                type="checkbox"
                checked={verArchivados}
                onChange={(e) => setFilter("archivados", e.target.checked ? "1" : "")}
              />
              <span className={styles.switchTrack} />
              Heroes archivados
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
