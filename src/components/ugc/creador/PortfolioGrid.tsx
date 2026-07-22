"use client";

import { useState } from "react";
import { deletePortfolioItemAction, movePortfolioItemAction } from "@/lib/actions/portfolio";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_CATEGORY_LABEL } from "@/lib/ugc/portfolio";
import { QosIcon } from "@/lib/ugc/qos-icons";
import MediaLightbox, { type LightboxItem } from "@/components/ugc/MediaLightbox";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type PortfolioTile = {
  id: string;
  url: string;
  media_type: "image" | "video";
  category: string;
  caption: string | null;
  views: number | null;
};

export default function PortfolioGrid({ items }: { items: PortfolioTile[] }) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [lightboxItem, setLightboxItem] = useState<LightboxItem | null>(null);

  const visibleItems =
    activeCategory === "all" ? items : items.filter((item) => item.category === activeCategory);

  return (
    <div>
      <div className={styles.subtabs}>
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`${styles.subtab} ${activeCategory === "all" ? styles.subtabOn : ""}`}
        >
          Todo
        </button>
        {PORTFOLIO_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`${styles.subtab} ${activeCategory === category ? styles.subtabOn : ""}`}
          >
            {PORTFOLIO_CATEGORY_LABEL[category]}
          </button>
        ))}
      </div>

      {activeCategory !== "all" && visibleItems.length > 1 && (
        <p style={{ marginBottom: "12px", fontSize: "12px", color: "var(--ink-3)" }}>
          Para reordenar tus piezas, mirá la vista &quot;Todo&quot; — el orden se guarda entre todas tus categorías.
        </p>
      )}

      {visibleItems.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>Todavía no subiste piezas en esta categoría.</div>
      ) : (
        <div className={styles.bookGrid}>
          {visibleItems.map((item, index) => (
            <div key={item.id} className={styles.bookClip}>
              <div
                className={styles.bookThumb}
                onClick={() =>
                  setLightboxItem({ url: item.url, media_type: item.media_type, caption: item.caption })
                }
                style={{ cursor: "pointer" }}
              >
                {item.media_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.caption ?? ""}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <video
                    src={item.url}
                    muted
                    playsInline
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                {item.media_type === "video" && (
                  <span className={styles.bookPlay} style={{ position: "relative", zIndex: 1 }}>
                    <QosIcon name="play" size={18} />
                  </span>
                )}
                {item.views != null && (
                  <span className={styles.bookViews}>▶ {item.views.toLocaleString("es-CR")}</span>
                )}
                <div className={styles.bookOverlay} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <form action={movePortfolioItemAction}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={activeCategory !== "all" || index === 0}
                        aria-label="Mover antes"
                        className={styles.bookOverlayBtn}
                      >
                        ←
                      </button>
                    </form>
                    <form action={movePortfolioItemAction}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={activeCategory !== "all" || index === visibleItems.length - 1}
                        aria-label="Mover después"
                        className={styles.bookOverlayBtn}
                      >
                        →
                      </button>
                    </form>
                  </div>
                  <form action={deletePortfolioItemAction}>
                    <input type="hidden" name="item_id" value={item.id} />
                    <button
                      type="submit"
                      aria-label="Eliminar"
                      className={styles.bookOverlayBtn}
                      style={{ color: "var(--risk)" }}
                    >
                      ×
                    </button>
                  </form>
                </div>
              </div>
              <div className={styles.bookInfo}>
                <b>{item.caption || PORTFOLIO_CATEGORY_LABEL[item.category as keyof typeof PORTFOLIO_CATEGORY_LABEL] || item.category}</b>
                <span>{PORTFOLIO_CATEGORY_LABEL[item.category as keyof typeof PORTFOLIO_CATEGORY_LABEL] ?? item.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
    </div>
  );
}
