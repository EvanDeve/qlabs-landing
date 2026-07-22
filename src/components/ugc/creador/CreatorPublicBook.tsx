"use client";

import { useState } from "react";
import MediaLightbox, { type LightboxItem } from "@/components/ugc/MediaLightbox";

type BookTile = {
  id: string;
  url: string;
  media_type: "image" | "video";
  caption: string | null;
};

export default function CreatorPublicBook({ items }: { items: BookTile[] }) {
  const [lightboxItem, setLightboxItem] = useState<LightboxItem | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLightboxItem({ url: item.url, media_type: item.media_type, caption: item.caption })}
            className="group relative aspect-square overflow-hidden rounded-card border border-line bg-lavender"
          >
            {item.media_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt={item.caption ?? ""} className="h-full w-full object-cover" />
            ) : (
              <>
                <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition group-hover:bg-black/55">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </span>
              </>
            )}
          </button>
        ))}
      </div>
      <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
    </>
  );
}
