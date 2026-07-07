"use client";

import { useState } from "react";
import { deletePortfolioItemAction, movePortfolioItemAction } from "@/lib/actions/portfolio";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_CATEGORY_LABEL } from "@/lib/ugc/portfolio";

type PortfolioTile = {
  id: string;
  url: string;
  media_type: "image" | "video";
  category: string;
  caption: string | null;
};

export default function PortfolioGrid({ items }: { items: PortfolioTile[] }) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const visibleItems =
    activeCategory === "all" ? items : items.filter((item) => item.category === activeCategory);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`rounded-pill px-4 py-1.5 text-sm font-bold transition ${
            activeCategory === "all"
              ? "bg-violet text-white"
              : "border border-line text-ink-soft hover:border-ink"
          }`}
        >
          Todo
        </button>
        {PORTFOLIO_CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`rounded-pill px-4 py-1.5 text-sm font-bold transition ${
              activeCategory === category
                ? "bg-violet text-white"
                : "border border-line text-ink-soft hover:border-ink"
            }`}
          >
            {PORTFOLIO_CATEGORY_LABEL[category]}
          </button>
        ))}
      </div>

      {activeCategory !== "all" && visibleItems.length > 1 && (
        <p className="mb-3 text-xs text-ink-soft">
          Para reordenar tus piezas, mirá la vista &quot;Todo&quot; — el orden se guarda entre todas tus categorías.
        </p>
      )}

      {visibleItems.length === 0 ? (
        <div className="rounded-card border border-line p-10 text-center text-ink-soft">
          Todavía no subiste piezas en esta categoría.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visibleItems.map((item, index) => (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-card border border-line bg-lavender"
            >
              {item.media_type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.caption ?? ""} className="h-full w-full object-cover" />
              ) : (
                <video src={item.url} className="h-full w-full object-cover" muted playsInline />
              )}

              {item.caption && (
                <span className="absolute bottom-2 left-2 right-2 rounded-pill bg-ink/70 px-2 py-1 text-center text-xs font-bold text-white">
                  {item.caption}
                </span>
              )}

              <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 bg-gradient-to-b from-ink/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                <div className="flex gap-1">
                  <form action={movePortfolioItemAction}>
                    <input type="hidden" name="item_id" value={item.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={activeCategory !== "all" || index === 0}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-ink disabled:opacity-40"
                      aria-label="Mover antes"
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
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-ink disabled:opacity-40"
                      aria-label="Mover después"
                    >
                      →
                    </button>
                  </form>
                </div>
                <form action={deletePortfolioItemAction}>
                  <input type="hidden" name="item_id" value={item.id} />
                  <button
                    type="submit"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-coral"
                    aria-label="Eliminar"
                  >
                    ×
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
