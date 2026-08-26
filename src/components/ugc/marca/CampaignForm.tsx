"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ugc/Toaster";
import { AGENCY_FEE_RATE, creatorPayout } from "@/lib/ugc/payout";
import { createClient } from "@/lib/supabase/client";
import { createCampaignAction, type CampaignActionState } from "@/lib/actions/campaigns";
import { CAMPAIGN_COVER_BUCKET, MAX_CAMPAIGN_COVER_BYTES } from "@/lib/ugc/campaign-covers";
import { subirArchivoDirecto, pesoLegible } from "@/lib/ugc/uploads";
import { DELIVERABLE_TYPES, FORMAT_LABEL } from "@/lib/ugc/deliverables";
import {
  USAGE_SCOPES,
  USAGE_DURATIONS,
  USAGE_SCOPE_LABEL,
  USAGE_SCOPE_DESC,
  USAGE_DURATION_LABEL,
} from "@/lib/ugc/usage-rights";
import styles from "@/styles/qos.module.css";

/**
 * Dónde se guarda el borrador del navegador, UNA CLAVE POR CUENTA.
 *
 * Con la clave fija que había antes, dos marcas en el mismo navegador se
 * pasaban el borrador: título, brief, presupuesto y derechos de uso, durante
 * siete días. No era teórico —una cuenta recién creada abrió "Nueva campaña" y
 * le apareció un brief ajeno con ₡180.000 ya cargados— y pesa porque el brief
 * es justo lo que el proyecto trata como confidencial: solo lo ve un creador
 * autenticado, vía `campaign_previews`.
 */
const claveBorrador = (brandId: string) => `ugc:campana-borrador:${brandId}`;

/**
 * La clave vieja, compartida. Se borra al entrar para que el borrador ajeno que
 * hoy está en el navegador de alguien no siga apareciendo después del arreglo.
 */
const BORRADOR_KEY_VIEJA = "ugc:campana-borrador";
/** Un brief de hace tres semanas apareciendo solo asusta más de lo que ayuda. */
const BORRADOR_VIDA_MS = 7 * 24 * 60 * 60 * 1000;

type Borrador = { savedAt: number; campos: Record<string, string> };

export default function CampaignForm({ brandId }: { brandId: string }) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<CampaignActionState>(null);
  const [isPending, startTransition] = useTransition();
  // Las cantidades viven en estado —y no sueltas en el DOM— para poder decir en
  // vivo si falta elegir un entregable, en vez de enterarse al enviar.
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(DELIVERABLE_TYPES.map((t) => [t, 0]))
  );
  // El presupuesto es el único campo de texto controlado: alimenta el
  // desglose que se dibuja debajo mientras se escribe.
  const [presupuesto, setPresupuesto] = useState("");
  const [restaurado, setRestaurado] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | null>(null);
  // La portada sube DIRECTO del navegador a Storage: un archivo de 5 MB no
  // pasa por el Server Action (tope de ~4.5 MB en Vercel). El input de archivo
  // va sin `name` a propósito — así no entra al borrador de localStorage, que
  // solo sabe guardar texto.
  const portadaRef = useRef<HTMLInputElement>(null);
  const [portada, setPortada] = useState<File | null>(null);
  const [portadaPreview, setPortadaPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const hayEntregable = DELIVERABLE_TYPES.some((t) => (qty[t] ?? 0) > 0);

  /**
   * Rescata lo que se estaba escribiendo la última vez.
   *
   * Se escribe sobre el DOM en un efecto en vez de pasar `defaultValue`: el
   * servidor no puede leer localStorage, así que sembrar los valores en el
   * primer render rompería la hidratación.
   */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    // Se limpia el resto de la clave compartida, exista o no borrador propio.
    try {
      localStorage.removeItem(BORRADOR_KEY_VIEJA);
    } catch {
      // Modo incógnito: no hay nada que limpiar.
    }

    let borrador: Borrador | null = null;
    try {
      borrador = JSON.parse(localStorage.getItem(claveBorrador(brandId)) ?? "null");
    } catch {
      // Basura en localStorage (otra versión del formato, edición a mano): se
      // ignora y se sigue con el formulario en blanco.
    }
    if (!borrador?.campos || Date.now() - borrador.savedAt > BORRADOR_VIDA_MS) return;

    const cantidades: Record<string, number> = {};
    for (const [name, value] of Object.entries(borrador.campos)) {
      const campo = form.elements.namedItem(name);
      if (!campo) continue;
      if (campo instanceof RadioNodeList) {
        campo.value = value;
      } else if (campo instanceof HTMLInputElement && campo.type === "checkbox") {
        campo.checked = value === "on";
      } else if (campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement) {
        campo.value = value;
      }
      const tipo = name.startsWith("qty_") ? name.slice(4) : null;
      if (tipo) cantidades[tipo] = Number(value) || 0;
      // Controlado: si solo se escribiera el DOM, el próximo render lo pisaría
      // con el estado vacío y el monto recuperado se borraría solo.
      if (name === "budget_amount") setPresupuesto(value);
    }
    setQty((prev) => ({ ...prev, ...cantidades }));
    setRestaurado(true);
    setGuardadoEn(borrador.savedAt);
  }, [brandId]);

  /**
   * Lleva la vista al error.
   *
   * Va en un efecto y no pegado al envío: el mensaje solo existe en el DOM
   * después de que React pinte el estado nuevo, así que hacer scroll en la
   * misma vuelta no encontraba nada — justo en el primer error, que es el que
   * importa. El error vive al pie de un formulario largo y quien envía desde
   * arriba no vería pasar nada.
   */
  useEffect(() => {
    if (state && "error" in state) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state]);

  function elegirPortada(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setState({ error: "La portada tiene que ser una imagen." });
      return;
    }
    if (file.size > MAX_CAMPAIGN_COVER_BYTES) {
      setState({
        error: `La portada pesa ${pesoLegible(file.size)} y el máximo es ${pesoLegible(MAX_CAMPAIGN_COVER_BYTES)}.`,
      });
      return;
    }
    setState(null);
    setPortada(file);
    setPortadaPreview(URL.createObjectURL(file));
  }

  /** Cada tecleo deja el formulario entero guardado. */
  function guardarBorrador() {
    const form = formRef.current;
    if (!form) return;
    const campos: Record<string, string> = {};
    for (const [name, value] of new FormData(form).entries()) {
      if (typeof value === "string" && name !== "intent") campos[name] = value;
    }
    const savedAt = Date.now();
    try {
      localStorage.setItem(claveBorrador(brandId), JSON.stringify({ savedAt, campos } satisfies Borrador));
      setGuardadoEn(savedAt);
    } catch {
      // Modo incógnito o cuota llena: no vale la pena molestar con un error,
      // el formulario sigue funcionando igual.
    }
  }

  /**
   * El envío es a mano y NO con <form action={...}>.
   *
   * Con `action`, React 19 hace form.reset() cuando la acción termina —también
   * cuando devuelve error—, así que un brief de 400 caracteres se borraba
   * entero por no haber elegido un entregable. Es el mismo motivo por el que
   * ContentPieceDrawer manda su form a mano.
   */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.value === "publish" ? "publish" : "draft";

    const formData = new FormData(form);
    formData.set("intent", intent);

    startTransition(async () => {
      if (portada) {
        setSubiendo(true);
        try {
          const ruta = await subirArchivoDirecto({
            bucket: CAMPAIGN_COVER_BUCKET,
            file: portada,
            maxBytes: MAX_CAMPAIGN_COVER_BYTES,
            extFallback: "jpg",
          });
          // Bucket público, igual que la foto del cupón: la URL se arma una vez
          // y se guarda. Nadie tiene que firmar nada para ver el feed.
          const { data } = createClient().storage.from(CAMPAIGN_COVER_BUCKET).getPublicUrl(ruta);
          formData.set("cover_url", data.publicUrl);
        } catch (e) {
          setState({ error: e instanceof Error ? e.message : "No se pudo subir la portada." });
          return;
        } finally {
          setSubiendo(false);
        }
      }

      const resultado = await createCampaignAction(formData);
      setState(resultado);
      if (resultado && "error" in resultado) return;
      // Solo se limpia cuando la campaña entró de verdad. Por eso la acción ya
      // no redirige: con redirect() adentro, esta línea nunca corría.
      localStorage.removeItem(claveBorrador(brandId));
      // El aviso se dispara ANTES de navegar y sobrevive igual: el Toaster vive
      // en el layout del panel y no se desmonta al cambiar de pantalla.
      toast(
        intent === "publish"
          ? "Campaña publicada — ya la ven los creadores."
          : "Borrador guardado. Lo publicás cuando quieras."
      );
      router.push("/ugc/marca/ugc");
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onInput={guardarBorrador}>
      {restaurado && (
        <p
          className={styles.formNote}
          style={{
            marginBottom: "15px",
            padding: "10px 12px",
            borderRadius: "var(--r-md)",
            background: "var(--b-50)",
            color: "var(--ink-2)",
          }}
        >
          Recuperamos lo que estabas escribiendo la última vez.
        </p>
      )}

      <p className={styles.mcFormSec}>Lo básico</p>
      <div className={styles.mcInset}>
        <div className={styles.mcCampo}>
          <label className={styles.mcCampoLabel} htmlFor="title">
            Título
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="Reel de brunch de domingo"
            className={styles.mcCampoInput}
          />
        </div>
        <div className={styles.mcCampo}>
          <label className={styles.mcCampoLabel} htmlFor="brief">
            Brief
          </label>
          <textarea
            id="brief"
            name="brief"
            required
            placeholder="Contá qué querés que el creador muestre: mood, ángulo, momentos clave."
            className={styles.mcCampoArea}
          />
        </div>
      </div>

      {/* La portada NO está en el mockup y se conserva igual: es lo primero
          que ve un creador en el feed, y sacarla dejaría todas las campañas
          nuevas con la tarjeta del logo. Lo que sí cambia es el control: el
          `<input type=file>` nativo salía crudo en medio de las tarjetas. */}
      <p className={styles.mcFormSec}>Portada</p>
      <div className={styles.mcInset}>
        <div className={styles.mcEntFila}>
          {portadaPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portadaPreview} alt="" className={styles.mcPortadaPrev} />
          ) : (
            <span className={styles.mcPortadaVacia}>Sin portada</span>
          )}
          <span className={styles.mcEntNombre} style={{ fontWeight: 400, fontSize: "12.5px", color: "var(--ink-3)", lineHeight: 1.4 }}>
            Se recorta apaisada. Sin portada, la tarjeta usa tu logo.
          </span>
          <input
            ref={portadaRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => elegirPortada(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => {
              if (portadaPreview) {
                setPortada(null);
                setPortadaPreview(null);
                if (portadaRef.current) portadaRef.current.value = "";
              } else {
                portadaRef.current?.click();
              }
            }}
            className={styles.mcCuponBtn}
          >
            {portadaPreview ? "Quitar" : "Elegir"}
          </button>
        </div>
      </div>

      <p className={styles.mcFormSec}>La oferta</p>
      <div className={styles.mcInset}>
        <div className={styles.mcFilaCampo}>
          <label className={styles.mcFilaCampoLabel} htmlFor="budget_amount">
            Presupuesto
          </label>
          <input
            id="budget_amount"
            name="budget_amount"
            type="number"
            required
            value={presupuesto}
            onChange={(e) => setPresupuesto(e.target.value)}
            placeholder="₡150000"
            className={`${styles.mcFilaCampoInput} ${styles.mcFilaCampoMonto}`}
          />
        </div>
        <div className={styles.mcFilaCampo}>
          <label className={styles.mcFilaCampoLabel} htmlFor="deadline_days">
            Plazo
          </label>
          <input
            id="deadline_days"
            name="deadline_days"
            type="number"
            placeholder="15 días"
            className={styles.mcFilaCampoInput}
          />
        </div>
        <div className={styles.mcFilaCampo}>
          <label className={styles.mcFilaCampoLabel} htmlFor="target_audience">
            Audiencia
          </label>
          <input
            id="target_audience"
            name="target_audience"
            placeholder="Food & lifestyle, 5K+"
            className={styles.mcFilaCampoInput}
          />
        </div>
        <div className={styles.mcFilaCampo}>
          <label className={styles.mcFilaCampoLabel} htmlFor="compensation_details">
            Compensación extra
          </label>
          <input
            id="compensation_details"
            name="compensation_details"
            placeholder="Brunch ×2"
            className={styles.mcFilaCampoInput}
          />
        </div>
      </div>

      {/* El reparto se ve mientras se decide el monto, que es cuando importa:
          después de publicar, enterarse de cuánto le llega al creador ya no
          cambia nada. Las tres cifras las ven las dos partes desde 2026-08-04. */}
      {Number(presupuesto) > 0 && (
        <div className={styles.mcBanda}>
          <span className={styles.mcBandaFuerte}>
            ₡{Number(presupuesto).toLocaleString("es-CR")}
          </span>
          <span>bruto</span>
          <span>− {Math.round(AGENCY_FEE_RATE * 100)}% Q Labs</span>
          <span className={styles.mcBandaFuerte}>
            ₡{creatorPayout(Number(presupuesto)).toLocaleString("es-CR")}
          </span>
          <span>al creador</span>
        </div>
      )}

      <p className={styles.mcFormSec}>Entregables · elegí al menos uno</p>
      <div className={styles.mcInset}>
        {DELIVERABLE_TYPES.map((type) => {
          const n = qty[type] ?? 0;
          return (
            <div key={type} className={`${styles.mcEntFila} ${n > 0 ? "" : styles.mcEntSin}`}>
              <span className={styles.mcEntNombre}>{FORMAT_LABEL[type]}</span>
              {/* El input sigue existiendo, escondido: es lo que lee el server
                  action. Los botones solo lo mueven. */}
              <input type="hidden" name={`qty_${type}`} value={n} />
              <span className={styles.mcStepper}>
                <button
                  type="button"
                  className={styles.mcStepBtn}
                  disabled={n === 0}
                  aria-label={`Menos ${FORMAT_LABEL[type]}`}
                  onClick={() =>
                    setQty((prev) => ({ ...prev, [type]: Math.max(0, (prev[type] ?? 0) - 1) }))
                  }
                >
                  −
                </button>
                <span className={styles.mcStepNum}>{n > 0 ? n : "—"}</span>
                <button
                  type="button"
                  className={styles.mcStepBtn}
                  aria-label={`Más ${FORMAT_LABEL[type]}`}
                  onClick={() => setQty((prev) => ({ ...prev, [type]: (prev[type] ?? 0) + 1 }))}
                >
                  +
                </button>
              </span>
            </div>
          );
        })}
      </div>
      {!hayEntregable && (
        <p className={styles.mcEntAviso}>Poné al menos un formato para poder publicar.</p>
      )}

      {/* Derechos de uso. Deliberadamente sin opción preseleccionada: define qué
          cede el creador, así que conviene que sea una decisión consciente y no
          el default que nadie miró. */}
      <fieldset className={styles.fieldGroup}>
        <legend>Derechos de uso del contenido</legend>

        <div style={{ marginBottom: "16px" }}>
          <span className={styles.fieldSub}>¿Dónde puede usarse el contenido?</span>
          <div className={styles.optList}>
            {USAGE_SCOPES.map((scope) => (
              <label key={scope} className={styles.optCard}>
                <input type="radio" name="usage_rights_scope" value={scope} required />
                <span>
                  <span className={styles.optTitle}>{USAGE_SCOPE_LABEL[scope]}</span>
                  <span className={styles.optDesc}>{USAGE_SCOPE_DESC[scope]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <span className={styles.fieldSub}>
            ¿Por cuánto tiempo?{" "}
            <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>
              (desde que aprobás la entrega)
            </span>
          </span>
          <div className={styles.optGrid}>
            {USAGE_DURATIONS.map((duration) => (
              <label key={duration} className={styles.optCard} style={{ alignItems: "center" }}>
                <input
                  type="radio"
                  name="usage_rights_duration"
                  value={duration}
                  required
                  style={{ marginTop: 0 }}
                />
                <span className={styles.optTitle}>{USAGE_DURATION_LABEL[duration]}</span>
              </label>
            ))}
          </div>
        </div>

        <label className={styles.optCard} style={{ marginBottom: "16px" }}>
          <input type="checkbox" name="usage_rights_editing" value="on" />
          <span>
            <span className={styles.optTitle}>Podés editar el material</span>
            <span className={styles.optDesc}>
              Si lo dejás sin marcar, te comprometés a publicar la pieza tal como te la entregan.
            </span>
          </span>
        </label>

        <TextArea
          label="Aclaraciones (opcional)"
          name="usage_rights_notes"
          placeholder="Ej: la pieza no puede usarse en campañas de otra sede."
          rows={2}
        />

        <p className={styles.formNote}>
          El creador siempre puede publicar la pieza en su propio perfil — es parte de cómo funciona
          el UGC.
        </p>
      </fieldset>

      {state && "error" in state && (
        <p ref={errorRef} className={styles.formError}>
          {state.error}
        </p>
      )}

      {/* Nada de "se guarda solo" a secas: esto vive en ESTE navegador, no en
          la cuenta. Decirlo de más sería prometer algo que no es. */}
      {guardadoEn && (
        <p className={styles.formNote}>
          Guardado en este navegador — si cerrás la página, lo recuperás al volver.
        </p>
      )}

      {/* Antes esto tenía una variante sin verificar, con "Guardar borrador"
          como acción principal. Se fue con el bloqueo duro: al panel solo entra
          una marca verificada, así que publicar siempre es una opción real. */}
      {/* El pie queda fijo abajo, sobre la barra de tabs. El mockup además
          repetía "Publicar" arriba a la derecha; no se dibuja: son dos botones
          para lo mismo a 600px de distancia y el de arriba queda al lado de
          "Cancelar", que es exactamente lo contrario. */}
      <div className={styles.trPieAire} />
      <div className={styles.trPie}>
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={isPending || !hayEntregable}
          title={hayEntregable ? undefined : "Elegí al menos un entregable"}
          className={styles.mcPieSec}
        >
          Guardar borrador
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={isPending || !hayEntregable}
          title={hayEntregable ? undefined : "Elegí al menos un entregable"}
          className={styles.trPiePill}
        >
          {subiendo ? "Subiendo portada…" : isPending ? "Publicando…" : "Publicar campaña"}
        </button>
      </div>
    </form>
  );
}

function TextArea({
  label,
  name,
  placeholder,
  required,
  rows = 4,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={name}>{label}</label>
      <textarea
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        rows={rows}
        className={styles.inp}
        style={{ resize: "vertical" }}
      />
    </div>
  );
}
