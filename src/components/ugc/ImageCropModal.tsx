"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const VIEWPORT = 300; // lado del área de recorte en pantalla
const OUTPUT = 512; // lado de la imagen final que se sube
const MAX_ZOOM = 4;

type Offset = { x: number; y: number };

/**
 * Recorte cuadrado de una imagen: zoom + arrastre. Se usa para la foto del
 * creador (máscara circular) y para el logo de la marca (máscara cuadrada,
 * `shape="square"`), que es como se muestran respectivamente en la app.
 *
 * Se monta con createPortal en document.body a propósito — así queda FUERA de
 * `.qosRoot`, cuyo reset de <button> le ganaría a las clases de Tailwind de
 * este modal (ver reset en qos.module.css). Además evita que un ancestro con
 * transform/filter le rompa el `position: fixed`.
 */
export default function ImageCropModal({
  file,
  onCancel,
  onConfirm,
  title = "Ajustá tu foto",
  hint = "Arrastrá para mover y usá el control para acercar.",
  confirmLabel = "Usar esta foto",
  shape = "circle",
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  title?: string;
  hint?: string;
  confirmLabel?: string;
  shape?: "circle" | "square";
}) {
  // url + img viajan juntos en un solo estado y se setean desde el callback
  // `onload`, no en el cuerpo del efecto (regla react-hooks/set-state-in-effect).
  const [loaded, setLoaded] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Object URL propio, liberado al desmontar.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setLoaded({ url, img: image });
      // Encuadre inicial centrado, calculado acá para no necesitar otro efecto.
      const base = VIEWPORT / Math.min(image.naturalWidth, image.naturalHeight);
      setOffset({
        x: (VIEWPORT - image.naturalWidth * base) / 2,
        y: (VIEWPORT - image.naturalHeight * base) / 2,
      });
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  const img = loaded?.img ?? null;
  const src = loaded?.url ?? null;

  // Escala mínima para que la imagen SIEMPRE cubra el cuadro (sin huecos).
  const baseScale = img ? VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = baseScale * zoom;
  const dw = img ? img.naturalWidth * scale : 0;
  const dh = img ? img.naturalHeight * scale : 0;

  const clamp = useCallback(
    (o: Offset, w: number, h: number): Offset => ({
      // El borde de la imagen nunca puede entrar en el cuadro de recorte.
      x: Math.min(0, Math.max(VIEWPORT - w, o.x)),
      y: Math.min(0, Math.max(VIEWPORT - h, o.y)),
    }),
    []
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }, dw, dh));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const changeZoom = (next: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    if (!img) {
      setZoom(z);
      return;
    }
    // Se mantiene fijo el punto central del recorte al hacer zoom.
    const prevW = img.naturalWidth * baseScale * zoom;
    const prevH = img.naturalHeight * baseScale * zoom;
    const cx = (VIEWPORT / 2 - offset.x) / prevW;
    const cy = (VIEWPORT / 2 - offset.y) / prevH;
    const w = img.naturalWidth * baseScale * z;
    const h = img.naturalHeight * baseScale * z;
    setZoom(z);
    setOffset(clamp({ x: VIEWPORT / 2 - cx * w, y: VIEWPORT / 2 - cy * h }, w, h));
  };

  const handleConfirm = async () => {
    if (!img) return;
    setSaving(true);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setSaving(false);
      return;
    }
    // Rectángulo de origen en coordenadas reales de la imagen.
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sSize = VIEWPORT / scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    if (!blob) {
      setSaving(false);
      return;
    }
    const base = file.name.replace(/\.[^.]+$/, "") || "avatar";
    onConfirm(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
  };

  // El modal solo se monta tras una interacción del usuario, así que nunca
  // llega a renderizarse en el servidor; la guarda es por si acaso, y evita
  // necesitar un estado `mounted` seteado desde un efecto.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{hint}</p>

        <div
          className="relative mx-auto mt-5 touch-none overflow-hidden rounded-card bg-lavender-deep"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {src && img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="max-w-none cursor-grab select-none active:cursor-grabbing"
              style={{
                width: dw,
                height: dh,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          {/* Máscara circular: previsualiza el recorte real. La sombra enorme
              oscurece todo lo de afuera y el overflow-hidden del contenedor la
              recorta al cuadro. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 ${
              shape === "circle" ? "rounded-full" : "rounded-card"
            }`}
            style={{ boxShadow: "0 0 0 9999px rgba(10,11,16,0.45)" }}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-xs font-bold text-ink-soft">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-violet"
            aria-label="Zoom"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-pill border border-line px-5 py-2.5 text-sm font-bold text-ink transition hover:border-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!img || saving}
            className="rounded-pill bg-violet px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
          >
            {saving ? "Aplicando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
