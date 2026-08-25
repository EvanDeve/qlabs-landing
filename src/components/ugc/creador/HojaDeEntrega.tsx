"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enviarEntregaAction,
  guardarArchivoDeSlotAction,
  quitarArchivoDeSlotAction,
} from "@/lib/actions/delivery-slots";
import { DELIVERIES_BUCKET, MAX_DELIVERY_FILE_BYTES } from "@/lib/ugc/deliveries";
import { pesoLegible, subirArchivoDirecto, SubidaCancelada } from "@/lib/ugc/uploads";
import type { SlotEntrega } from "@/lib/ugc/delivery-slots";
import styles from "@/styles/qos.module.css";

/** Lo que ya estaba guardado cuando se abrió la hoja. */
export type ArchivoGuardado = { slot: string; nombre: string | null; peso: number | null };

type Estado =
  | { fase: "vacio" }
  | { fase: "subiendo"; nombre: string; peso: number; progreso: number; desde: number }
  | { fase: "error"; nombre: string; mensaje: string }
  | { fase: "listo"; nombre: string; peso: number | null; detalle: string | null; preview: string | null };

const PLATAFORMAS = [
  { id: "instagram", label: "Instagram", ejemplo: "instagram.com/reel/..." },
  { id: "tiktok", label: "TikTok", ejemplo: "tiktok.com/@usuario/..." },
] as const;

/**
 * Dimensiones y duración salen del archivo en el navegador, antes de subirlo.
 * No se guardan en ninguna parte: son para que el creador confirme de un
 * vistazo que mandó el archivo correcto, que es cuando importan.
 */
async function leerDetalle(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      const medido = await new Promise<string | null>((resolve) => {
        img.onload = () => resolve(`${img.naturalWidth}×${img.naturalHeight}`);
        img.onerror = () => resolve(null);
        img.src = url;
      });
      return medido;
    }
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      return await new Promise<string | null>((resolve) => {
        v.onloadedmetadata = () => {
          const seg = Math.round(v.duration);
          const dur = Number.isFinite(seg)
            ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`
            : null;
          const dim = v.videoWidth ? `${v.videoWidth}×${v.videoHeight}` : null;
          resolve([dim, dur].filter(Boolean).join(" · ") || null);
        };
        v.onerror = () => resolve(null);
        v.src = url;
      });
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function restante(estado: Extract<Estado, { fase: "subiendo" }>): string {
  const transcurrido = (Date.now() - estado.desde) / 1000;
  // Antes de los primeros 2 s o del 5% cualquier estimación es ruido: da
  // "quedan 4 minutos" para un archivo que tarda diez segundos.
  if (transcurrido < 2 || estado.progreso < 0.05) return "Subiendo";
  const total = transcurrido / estado.progreso;
  const faltan = Math.max(1, Math.round(total - transcurrido));
  if (faltan < 60) return `Subiendo · quedan ${faltan} s`;
  return `Subiendo · quedan ${Math.ceil(faltan / 60)} min`;
}

export default function HojaDeEntrega({
  applicationId,
  titulo,
  marca,
  brief,
  slots,
  guardados,
  onListo,
}: {
  applicationId: string;
  titulo: string;
  marca: string | null;
  brief: string | null;
  slots: SlotEntrega[];
  guardados: ArchivoGuardado[];
  onListo: () => void;
}) {
  const router = useRouter();
  const [estados, setEstados] = useState<Record<string, Estado>>(() => {
    const inicial: Record<string, Estado> = {};
    for (const s of slots) {
      const ya = guardados.find((g) => g.slot === s.id);
      inicial[s.id] = ya
        ? { fase: "listo", nombre: ya.nombre ?? "Archivo entregado", peso: ya.peso, detalle: null, preview: null }
        : { fase: "vacio" };
    }
    return inicial;
  });
  const [links, setLinks] = useState<Record<string, string>>({});
  const [nota, setNota] = useState("");
  const [confirma, setConfirma] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, forzarTic] = useState(0);

  // El archivo elegido se guarda para poder reintentar sin volver a elegirlo:
  // perder señal a mitad de una subida de 40 MB y tener que buscar el archivo
  // otra vez en el teléfono es la parte que hace abandonar.
  const archivos = useRef<Record<string, File>>({});
  const abortos = useRef<Record<string, AbortController>>({});
  const previews = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const destino = useRef<string | null>(null);
  const subiendoAlgo = Object.values(estados).some((e) => e.fase === "subiendo");

  // El "quedan N s" se recalcula solo mientras haya algo subiendo.
  useEffect(() => {
    if (!subiendoAlgo) return;
    const id = setInterval(() => forzarTic((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [subiendoAlgo]);

  useEffect(() => {
    const urls = previews.current;
    const enVuelo = abortos.current;
    return () => {
      urls.forEach(URL.revokeObjectURL);
      Object.values(enVuelo).forEach((a) => a.abort());
    };
  }, []);

  const listos = slots.filter((s) => estados[s.id]?.fase === "listo").length;
  const completo = slots.length > 0 && listos === slots.length;

  function actualizar(slot: string, estado: Estado) {
    setEstados((prev) => ({ ...prev, [slot]: estado }));
  }

  async function subir(slot: string, file: File) {
    setError(null);
    archivos.current[slot] = file;

    if (file.size > MAX_DELIVERY_FILE_BYTES) {
      actualizar(slot, {
        fase: "error",
        nombre: file.name,
        mensaje: `Pesa ${pesoLegible(file.size)} y el máximo es ${pesoLegible(
          MAX_DELIVERY_FILE_BYTES
        )}. Exportalo con menos calidad, o subilo a Drive y pegá el link abajo.`,
      });
      return;
    }

    const control = new AbortController();
    abortos.current[slot] = control;
    actualizar(slot, { fase: "subiendo", nombre: file.name, peso: file.size, progreso: 0, desde: Date.now() });

    try {
      const detalle = await leerDetalle(file);
      const storagePath = await subirArchivoDirecto({
        bucket: DELIVERIES_BUCKET,
        carpeta: applicationId,
        file,
        maxBytes: MAX_DELIVERY_FILE_BYTES,
        extFallback: "mp4",
        signal: control.signal,
        onProgreso: (fraccion) =>
          setEstados((prev) => {
            const actual = prev[slot];
            if (actual?.fase !== "subiendo") return prev;
            return { ...prev, [slot]: { ...actual, progreso: fraccion } };
          }),
      });

      const fd = new FormData();
      fd.set("application_id", applicationId);
      fd.set("slot", slot);
      fd.set("storage_path", storagePath);
      fd.set("nombre", file.name);
      const res = await guardarArchivoDeSlotAction(fd);

      if ("error" in res) {
        actualizar(slot, { fase: "error", nombre: file.name, mensaje: res.error });
        return;
      }

      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      if (preview) previews.current.push(preview);
      actualizar(slot, { fase: "listo", nombre: file.name, peso: file.size, detalle, preview });
    } catch (err) {
      if (err instanceof SubidaCancelada) {
        actualizar(slot, { fase: "vacio" });
        return;
      }
      actualizar(slot, {
        fase: "error",
        nombre: file.name,
        mensaje: err instanceof Error ? err.message : "Se cortó la subida.",
      });
    } finally {
      delete abortos.current[slot];
    }
  }

  function elegir(slot: string | null, modo: "camara" | "galeria" | "archivos") {
    const objetivo = slot ?? slots.find((s) => estados[s.id]?.fase !== "listo")?.id ?? null;
    if (!objetivo || !inputRef.current) return;
    destino.current = objetivo;
    const input = inputRef.current;
    input.accept = modo === "camara" ? "image/*,video/*" : modo === "galeria" ? "image/*,video/*" : "";
    if (modo === "camara") input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.click();
  }

  async function quitar(slot: string) {
    abortos.current[slot]?.abort();
    const fd = new FormData();
    fd.set("application_id", applicationId);
    fd.set("slot", slot);
    await quitarArchivoDeSlotAction(fd);
    delete archivos.current[slot];
    actualizar(slot, { fase: "vacio" });
  }

  async function enviar() {
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("application_id", applicationId);
      fd.set("nota", nota);
      if (confirma) fd.set("confirma", "on");
      for (const p of PLATAFORMAS) {
        const v = links[p.id]?.trim();
        if (v) fd.append("link", v);
      }
      const res = await enviarEntregaAction(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
      onListo();
    } finally {
      setEnviando(false);
    }
  }

  const puedeEnviar = completo && confirma && !enviando && !subiendoAlgo;

  return (
    <div>
      <div className={styles.entHead}>
        <h2 className={styles.entTitulo}>Entregar pieza</h2>
        <p className={styles.entSub}>{[titulo, marca].filter(Boolean).join(" · ")}</p>
      </div>

      {slots.length > 0 && (
        <div className={styles.entProgreso}>
          <div className={styles.entBarra}>
            <span
              className={`${styles.entBarraFill} ${completo ? styles.entBarraFillOk : ""}`}
              style={{ width: `${(listos / slots.length) * 100}%` }}
            />
          </div>
          <span className={`${styles.entCuenta} ${completo ? styles.entCuentaOk : ""}`}>
            {listos} de {slots.length}
          </span>
        </div>
      )}

      {brief && (
        <details className={styles.entBrief}>
          <summary>Qué te pidieron</summary>
          <p>{brief}</p>
        </details>
      )}

      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          const slot = destino.current;
          e.target.value = "";
          if (file && slot) void subir(slot, file);
        }}
      />

      <div className={styles.entSlots}>
        {slots.map((slot) => {
          const estado = estados[slot.id] ?? { fase: "vacio" as const };
          return (
            <div
              key={slot.id}
              className={`${styles.entSlot} ${estado.fase === "error" ? styles.entSlotError : ""}`}
            >
              <div
                className={`${styles.entThumb} ${estado.fase === "error" ? styles.entThumbError : ""}`}
              >
                {estado.fase === "listo" && estado.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={estado.preview}
                    alt=""
                    className={styles.entThumbImg}
                    // Un formato que el navegador no sabe dibujar —un HEIC de
                    // iPhone en Firefox, por ejemplo— dejaba el ícono de imagen
                    // rota en el medio de la hoja. Sin la miniatura se ven las
                    // rayas, que es lo que muestra cualquier caja sin foto.
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : estado.fase === "subiendo" ? (
                  <span className={styles.entSpinner} aria-hidden />
                ) : estado.fase === "error" ? (
                  <span className={styles.entThumbBang}>!</span>
                ) : null}
              </div>

              <div className={styles.entSlotCuerpo}>
                <div className={styles.entSlotTop}>
                  <span
                    className={`${styles.entBadge} ${
                      estado.fase === "error" ? styles.entBadgeError : ""
                    }`}
                  >
                    {slot.etiqueta}
                  </span>
                  {estado.fase === "listo" && (
                    <span className={styles.entTilde} aria-label="listo">
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12.5l5.5 5.5L20 7" />
                      </svg>
                    </span>
                  )}
                  <span className={styles.entSlotAcc}>
                    {estado.fase === "listo" && (
                      <button type="button" className={styles.entLink} onClick={() => elegir(slot.id, "archivos")}>
                        Cambiar
                      </button>
                    )}
                    {estado.fase === "subiendo" && (
                      <button type="button" className={styles.entLinkGris} onClick={() => quitar(slot.id)}>
                        Cancelar
                      </button>
                    )}
                  </span>
                </div>

                {estado.fase === "vacio" ? (
                  <button type="button" className={styles.entElegir} onClick={() => elegir(slot.id, "archivos")}>
                    Elegir archivo
                  </button>
                ) : estado.fase === "error" ? (
                  <>
                    <div className={styles.entSlotNombre}>Se cortó la subida</div>
                    <p className={styles.entSlotErrorTxt}>{estado.mensaje}</p>
                    <button
                      type="button"
                      className={styles.entReintentar}
                      onClick={() => {
                        const f = archivos.current[slot.id];
                        if (f) void subir(slot.id, f);
                        else elegir(slot.id, "archivos");
                      }}
                    >
                      Reintentar
                    </button>
                  </>
                ) : (
                  <>
                    <div className={styles.entSlotNombre}>{estado.nombre}</div>
                    {estado.fase === "subiendo" ? (
                      <>
                        <div className={styles.entSubFila}>
                          <div className={styles.entBarraChica}>
                            <span
                              className={styles.entBarraFill}
                              style={{ width: `${Math.round(estado.progreso * 100)}%` }}
                            />
                          </div>
                          <span className={styles.entPct}>{Math.round(estado.progreso * 100)}%</span>
                        </div>
                        <p className={styles.entSlotMeta}>{restante(estado)}</p>
                      </>
                    ) : (
                      <p className={styles.entSlotMeta}>
                        {[estado.peso != null ? pesoLegible(estado.peso) : null, estado.detalle, "listo"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!completo && (
        <div className={styles.entFuentes}>
          <button type="button" className={styles.entFuente} onClick={() => elegir(null, "camara")}>
            Cámara
          </button>
          <button type="button" className={styles.entFuente} onClick={() => elegir(null, "galeria")}>
            Galería
          </button>
          <button type="button" className={styles.entFuente} onClick={() => elegir(null, "archivos")}>
            Archivos
          </button>
        </div>
      )}

      <div className={styles.entTabla}>
        {PLATAFORMAS.map((p) => (
          <label key={p.id} className={styles.entFila}>
            <span className={styles.entFilaLabel}>{p.label}</span>
            <input
              type="url"
              inputMode="url"
              className={styles.entFilaInput}
              placeholder={p.ejemplo}
              value={links[p.id] ?? ""}
              onChange={(e) => setLinks((prev) => ({ ...prev, [p.id]: e.target.value }))}
            />
          </label>
        ))}
        <label className={styles.entFila}>
          <span className={styles.entFilaLabel}>Nota</span>
          <textarea
            className={`${styles.entFilaInput} ${styles.entFilaNota}`}
            rows={2}
            placeholder="Algo que la marca deba saber (opcional)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </label>
      </div>

      <p className={styles.entAviso}>
        <span className={styles.entAvisoIc} aria-hidden>
          i
        </span>
        <span>
          {marca ?? "La marca"} revisa la entrega. Si algo no cuadra, podés reportar un problema
          desde Mis aplicaciones.
        </span>
      </p>

      {error && <p className={styles.entError}>{error}</p>}

      <label className={styles.entConfirma}>
        <input type="checkbox" checked={confirma} onChange={(e) => setConfirma(e.target.checked)} />
        <span>Confirmo que la pieza cumple el brief y los derechos acordados.</span>
      </label>

      <button type="button" className={styles.entEnviar} disabled={!puedeEnviar} onClick={enviar}>
        {enviando ? "Enviando…" : "Enviar entrega"}
      </button>
      <p className={styles.entPie}>
        {subiendoAlgo
          ? "Esperá a que terminen las subidas"
          : !completo && slots.length > 0
            ? `Falta${slots.length - listos > 1 ? "n" : ""} ${slots.length - listos} archivo${
                slots.length - listos > 1 ? "s" : ""
              } · se habilita cuando los ${slots.length} estén listos`
            : !confirma
              ? "Marcá la confirmación para poder enviar"
              : "Queda en estado Entregada hasta que la marca la apruebe"}
      </p>
    </div>
  );
}
