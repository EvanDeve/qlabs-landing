"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPortfolioItemAction } from "@/lib/actions/portfolio";
import {
  PORTFOLIO_BUCKET,
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_CATEGORY_LABEL,
  MAX_PORTFOLIO_FILE_BYTES,
} from "@/lib/ugc/portfolio";
import { pesoLegible, subirArchivoDirecto, SubidaCancelada } from "@/lib/ugc/uploads";
import Hoja from "./Hoja";
import styles from "@/styles/qos.module.css";

/**
 * Forma y duración del archivo, leídas en el navegador antes de subirlo.
 *
 * "vertical" es el dato que más importa acá: el book es de piezas para redes y
 * una horizontal se ve mal en todos lados. Decirlo ANTES de subir evita que el
 * creador gaste 20 MB de datos móviles para enterarse después.
 */
async function leerForma(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      return await new Promise<string | null>((resolve) => {
        img.onload = () => resolve(img.naturalHeight >= img.naturalWidth ? "vertical" : "horizontal");
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      return await new Promise<string | null>((resolve) => {
        v.onloadedmetadata = () =>
          resolve(v.videoHeight >= v.videoWidth ? "vertical" : "horizontal");
        v.onerror = () => resolve(null);
        v.src = url;
      });
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SubirPieza({ etiqueta }: { etiqueta: string }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [forma, setForma] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string>(PORTFOLIO_CATEGORIES[0]);
  const [progreso, setProgreso] = useState(0);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "guardando">("quieto");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const previewRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ocupado = estado !== "quieto";

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function limpiar() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setFile(null);
    setForma(null);
    setProgreso(0);
    setError(null);
  }

  async function elegir(f: File) {
    limpiar();
    setFile(f);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      previewRef.current = url;
      setPreview(url);
    }
    setForma(await leerForma(f));
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    if (!file) {
      setError("Elegí un archivo para subir.");
      return;
    }

    const mediaType = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
        ? "image"
        : null;
    if (!mediaType) {
      setError("Solo se aceptan imágenes o videos.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("category", categoria);
    setError(null);

    const control = new AbortController();
    abortRef.current = control;

    try {
      setEstado("subiendo");
      // Sin `carpeta`: el helper usa el uuid del creador, que es lo que exige
      // la policy del bucket `portfolio`.
      const storagePath = await subirArchivoDirecto({
        bucket: PORTFOLIO_BUCKET,
        file,
        maxBytes: MAX_PORTFOLIO_FILE_BYTES,
        extFallback: mediaType === "video" ? "mp4" : "jpg",
        signal: control.signal,
        onProgreso: setProgreso,
      });

      formData.set("storage_path", storagePath);
      formData.set("media_type", mediaType);

      setEstado("guardando");
      const result = await uploadPortfolioItemAction(null, formData);

      if (result) {
        setError(result.error);
        return;
      }

      formRef.current?.reset();
      limpiar();
      setCategoria(PORTFOLIO_CATEGORIES[0]);
      // El action revalida, pero acá se lo llama a mano (no por useActionState),
      // así que el refresh va explícito o la pieza recién subida no aparece.
      router.refresh();
      setAbierta(false);
    } catch (err) {
      if (err instanceof SubidaCancelada) return;
      setError(err instanceof Error ? err.message : "No se pudo subir la pieza.");
    } finally {
      abortRef.current = null;
      setEstado("quieto");
    }
  }

  return (
    <>
      <button type="button" className={styles.bookSubir} onClick={() => setAbierta(true)}>
        + {etiqueta}
      </button>

      {abierta && (
        <Hoja
          titulo="Subir pieza"
          onClose={() => {
            if (ocupado) return;
            limpiar();
            setAbierta(false);
          }}
          pie={
            <button
              type="submit"
              form="form-pieza"
              disabled={!file || ocupado}
              className={styles.entEnviar}
              style={{ marginTop: 0 }}
            >
              {estado === "subiendo"
                ? `Subiendo… ${Math.round(progreso * 100)}%`
                : estado === "guardando"
                  ? "Guardando…"
                  : "Agregar al book"}
            </button>
          }
        >
          <form id="form-pieza" ref={formRef} onSubmit={enviar}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void elegir(f);
              }}
            />

            {!file ? (
              <button
                type="button"
                className={styles.bookElegir}
                onClick={() => inputRef.current?.click()}
              >
                Elegir un archivo
              </button>
            ) : (
              <div className={styles.bookArchivo}>
                <div className={styles.bookArchivoThumb}>
                  {preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt=""
                      className={styles.entThumbImg}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </div>
                <div className={styles.bookArchivoDatos}>
                  <div className={styles.bookArchivoNombre}>{file.name}</div>
                  <div className={styles.bookArchivoMeta}>
                    {pesoLegible(file.size)} de {pesoLegible(MAX_PORTFOLIO_FILE_BYTES)}
                    {forma && ` · ${forma}`}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.entLink}
                  onClick={() => inputRef.current?.click()}
                  disabled={ocupado}
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* Una horizontal no se rechaza: hay piezas horizontales que valen
                la pena y decidir por el creador sería de más. Se avisa, que es
                lo que necesita para elegir a conciencia. */}
            {forma === "horizontal" && (
              <p className={styles.bookAvisoForma}>
                Es horizontal. El book se ve casi siempre en el teléfono, así que una vertical luce
                mucho mejor.
              </p>
            )}

            <p className={styles.hojaGrupoLabel} style={{ marginTop: 16 }}>
              Categoría
            </p>
            <div className={styles.platChips}>
              {PORTFOLIO_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={categoria === c}
                  onClick={() => setCategoria(c)}
                  className={`${styles.platChip} ${categoria === c ? styles.platChipOn : ""}`}
                >
                  {PORTFOLIO_CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>

            {/* Un solo campo de texto, que es el nombre de la pieza y también
                el título de su tarjeta en la grilla. Se llama "Nombre" y ya no
                "Descripción": lo que se escriba acá es lo que se va a leer
                grande, y "descripción" invitaba a escribir un párrafo. */}
            <label className={styles.hojaCampo}>
              <span className={styles.hojaCampoLabel}>Nombre de la pieza</span>
              <input
                type="text"
                name="caption"
                placeholder="Reel del brunch en Zonna"
                className={styles.hojaCampoInput}
              />
            </label>

            <div className={styles.hojaTabla}>
              <label className={styles.hojaFila}>
                <span className={styles.hojaFilaLabel}>Views</span>
                <input
                  type="number"
                  name="views"
                  min={0}
                  inputMode="numeric"
                  placeholder="82000"
                  className={styles.hojaFilaSelect}
                />
              </label>
            </div>

            <p className={styles.entAviso}>
              <span className={styles.entAvisoIc} aria-hidden>
                i
              </span>
              <span>
                Hasta {pesoLegible(MAX_PORTFOLIO_FILE_BYTES)} por pieza. Si es más grande, bajale la
                resolución.
              </span>
            </p>

            {estado === "subiendo" && (
              <div className={styles.entSubFila}>
                <div className={styles.entBarraChica}>
                  <span
                    className={styles.entBarraFill}
                    style={{ width: `${Math.round(progreso * 100)}%` }}
                  />
                </div>
                <span className={styles.entPct}>{Math.round(progreso * 100)}%</span>
              </div>
            )}

            {error && <p className={styles.entError}>{error}</p>}
          </form>
        </Hoja>
      )}
    </>
  );
}
