"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePortfolioItemAction, movePortfolioItemAction } from "@/lib/actions/portfolio";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_CATEGORY_LABEL } from "@/lib/ugc/portfolio";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export type PortfolioTile = {
  id: string;
  url: string;
  media_type: "image" | "video";
  category: string;
  caption: string | null;
  views: number | null;
  created_at: string;
};

/** "agosto" / "agosto 2026" a partir del `created_at` de la pieza. */
function mesDe(iso: string, conAnio = false): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CR", { month: "long", ...(conAnio ? { year: "numeric" } : {}) });
}

/**
 * Cómo se llama la pieza. Es el nombre que le puso el creador —el mismo campo
 * que hasta hoy se pedía como "descripción"— y no hay otro: no existe una
 * columna de marca ni un link a la campaña. Quien quiera poner "Zonna
 * Gastrobar" lo escribe ahí.
 */
function titulo(item: PortfolioTile): string {
  return item.caption?.trim() || "Sin nombre";
}

/** La bajada: qué tipo de pieza es y de cuándo. */
function bajada(item: PortfolioTile, conAnio = false): string {
  const cat = PORTFOLIO_CATEGORY_LABEL[item.category] ?? item.category;
  return `${cat} · ${mesDe(item.created_at, conAnio)}`;
}

export default function PortfolioGrid({ items }: { items: PortfolioTile[] }) {
  const [categoria, setCategoria] = useState<string>("all");
  const [abierta, setAbierta] = useState<number | null>(null);

  const visibles = categoria === "all" ? items : items.filter((i) => i.category === categoria);
  const contar = (c: string) => (c === "all" ? items.length : items.filter((i) => i.category === c).length);

  return (
    <div>
      {/* Los chips llevan el conteo: con dos categorías el número es lo único
          que dice si vale la pena tocar el filtro. */}
      <div className={styles.pipeChips}>
        <button
          type="button"
          onClick={() => setCategoria("all")}
          className={`${styles.pipeChip} ${categoria === "all" ? styles.pipeChipOn : ""}`}
        >
          Todo
          <span className={styles.pipeChipNum}>{contar("all")}</span>
        </button>
        {PORTFOLIO_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoria(c)}
            className={`${styles.pipeChip} ${categoria === c ? styles.pipeChipOn : ""}`}
          >
            {PORTFOLIO_CATEGORY_LABEL[c]}
            <span className={styles.pipeChipNum}>{contar(c)}</span>
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>
          Todavía no subiste piezas en esta categoría.
        </div>
      ) : (
        <div className={styles.bookGrid}>
          {visibles.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={styles.bookClip}
              onClick={() => setAbierta(i)}
            >
              <div className={styles.bookThumb}>
                {item.media_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.caption ?? ""} className={styles.bookMedia} />
                ) : (
                  <video src={item.url} muted playsInline className={styles.bookMedia} />
                )}
                <span className={styles.bookCat}>
                  {PORTFOLIO_CATEGORY_LABEL[item.category] ?? item.category}
                </span>
                {item.views != null && (
                  <span className={styles.bookViews}>
                    <QosIcon name="play" size={9} />
                    {item.views.toLocaleString("es-CR")}
                  </span>
                )}
              </div>
              <div className={styles.bookInfo}>
                <div className={styles.bookTitulo}>{titulo(item)}</div>
                <div className={styles.bookBajada}>{bajada(item)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {abierta != null && visibles[abierta] && (
        <VisorPieza
          items={visibles}
          indice={abierta}
          onIr={setAbierta}
          onClose={() => setAbierta(null)}
        />
      )}
    </div>
  );
}

/**
 * El visor a pantalla completa, en oscuro.
 *
 * Va oscuro y no como una hoja más porque acá la pieza es todo: el fondo claro
 * del panel le compite a un video vertical y le cambia los colores a la vista.
 * Es la misma pantalla que la marca va a ver del otro lado.
 */
function VisorPieza({
  items,
  indice,
  onIr,
  onClose,
}: {
  items: PortfolioTile[];
  indice: number;
  onIr: (i: number) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const item = items[indice];
  const [borrando, setBorrando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && indice < items.length - 1) onIr(indice + 1);
      if (e.key === "ArrowLeft" && indice > 0) onIr(indice - 1);
    }
    document.addEventListener("keydown", alTeclado);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = previo;
    };
  }, [indice, items.length, onIr, onClose]);

  async function borrar() {
    setBorrando(true);
    const fd = new FormData();
    fd.set("item_id", item.id);
    await deletePortfolioItemAction(fd);
    router.refresh();
    onClose();
  }

  return (
    <div className={styles.visor}>
      <div className={styles.visorTop}>
        <button type="button" onClick={onClose} className={styles.visorIcon} aria-label="Cerrar">
          <QosIcon name="x" size={17} />
        </button>
        <span className={styles.visorCuenta}>
          {indice + 1} de {items.length}
        </span>
        {/* Reordenar vive acá y no en la grilla: en el teléfono los botones
            flotando sobre cada miniatura se tocaban solos al hacer scroll. */}
        <div className={styles.visorOrden}>
          <form action={movePortfolioItemAction}>
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              className={styles.visorIcon}
              disabled={indice === 0}
              aria-label="Mover antes"
            >
              <QosIcon name="chevL" size={16} />
            </button>
          </form>
          <form action={movePortfolioItemAction}>
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              className={styles.visorIcon}
              disabled={indice === items.length - 1}
              aria-label="Mover después"
            >
              <QosIcon name="chevR" size={16} />
            </button>
          </form>
        </div>
      </div>

      <div className={styles.visorMedia}>
        {item.media_type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.caption ?? ""} className={styles.visorImg} />
        ) : (
          <video src={item.url} controls playsInline className={styles.visorImg} />
        )}
      </div>

      <div className={styles.visorPie}>
        <div className={styles.visorDatos}>
          <div className={styles.visorTitulo}>{titulo(item)}</div>
          <div className={styles.visorBajada}>{bajada(item, true)}</div>
        </div>
        {item.views != null && (
          <div className={styles.visorViews}>
            <strong>{item.views.toLocaleString("es-CR")}</strong>
            <span>views</span>
          </div>
        )}
      </div>

      {confirmar ? (
        // Confirmación in-page y NO window.confirm(): el nativo congela la
        // automatización del navegador y encima no se puede escribir.
        <div className={styles.visorConfirma}>
          <span>Se borra esta pieza del book. No se puede deshacer.</span>
          <div className={styles.visorConfirmaBtns}>
            <button
              type="button"
              className={styles.visorAccion}
              onClick={() => setConfirmar(false)}
              disabled={borrando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles.visorAccion} ${styles.visorAccionRoja}`}
              onClick={borrar}
              disabled={borrando}
            >
              {borrando ? "Borrando…" : "Sí, borrar"}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.visorAcciones}>
          <button type="button" className={styles.visorAccion} onClick={() => setConfirmar(true)}>
            Eliminar del book
          </button>
        </div>
      )}
    </div>
  );
}
