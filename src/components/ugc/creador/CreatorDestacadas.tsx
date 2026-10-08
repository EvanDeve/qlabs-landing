"use client";

import { useState } from "react";
import MediaLightbox, { type LightboxItem } from "@/components/ugc/MediaLightbox";

type Destacada = {
  id: string;
  url: string;
  media_type: "image" | "video";
  caption: string | null;
};

/**
 * Las hasta 3 piezas que el creador eligió para abrir su kit (spec 002).
 *
 * Van en vertical (9:16) y no cuadradas como el resto del book: casi todo lo
 * que se destaca es un reel, y recortado al cuadrado pierde justo lo que lo
 * hace bueno.
 */
export default function CreatorDestacadas({ items }: { items: Destacada[] }) {
  const [abierta, setAbierta] = useState<LightboxItem | null>(null);
  // Un archivo borrado de Storage deja la fila viva: esa pieza se muestra
  // como hueco en vez de una imagen rota, y las demás siguen igual.
  const [rotas, setRotas] = useState<Set<string>>(new Set());
  const marcarRota = (id: string) => setRotas((prev) => new Set(prev).add(id));

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        {items.map((item) => {
          const rota = rotas.has(item.id);
          return (
            <div key={item.id} className="min-w-0">
              <button
                type="button"
                disabled={rota}
                onClick={() => setAbierta({ url: item.url, media_type: item.media_type, caption: item.caption })}
                className="group relative block aspect-[9/16] w-full overflow-hidden rounded-card border border-line bg-lavender"
              >
                {rota ? (
                  <span className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] font-semibold text-ink-soft">
                    No disponible
                  </span>
                ) : item.media_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.caption ?? ""}
                    onError={() => marcarRota(item.id)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <video
                      src={item.url}
                      onError={() => marcarRota(item.id)}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition group-hover:bg-black/55">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    </span>
                  </>
                )}
              </button>
              {item.caption?.trim() && (
                <p className="mt-1.5 truncate text-xs font-semibold text-ink">{item.caption}</p>
              )}
            </div>
          );
        })}
      </div>
      <MediaLightbox item={abierta} onClose={() => setAbierta(null)} />
    </>
  );
}
