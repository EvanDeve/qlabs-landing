"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ugc/Toaster";
import DesglosePago from "@/components/ugc/DesglosePago";
import { createCampaignAction, type CampaignActionState } from "@/lib/actions/campaigns";
import { DELIVERABLE_TYPES, FORMAT_LABEL } from "@/lib/ugc/deliverables";
import {
  USAGE_SCOPES,
  USAGE_DURATIONS,
  USAGE_SCOPE_LABEL,
  USAGE_SCOPE_DESC,
  USAGE_DURATION_LABEL,
} from "@/lib/ugc/usage-rights";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/** Dónde se guarda el borrador del navegador. */
const BORRADOR_KEY = "ugc:campana-borrador";
/** Un brief de hace tres semanas apareciendo solo asusta más de lo que ayuda. */
const BORRADOR_VIDA_MS = 7 * 24 * 60 * 60 * 1000;

type Borrador = { savedAt: number; campos: Record<string, string> };

export default function CampaignForm({ verified }: { verified: boolean }) {
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
    let borrador: Borrador | null = null;
    try {
      borrador = JSON.parse(localStorage.getItem(BORRADOR_KEY) ?? "null");
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
  }, []);

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
      localStorage.setItem(BORRADOR_KEY, JSON.stringify({ savedAt, campos } satisfies Borrador));
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
      const resultado = await createCampaignAction(formData);
      setState(resultado);
      if (resultado && "error" in resultado) return;
      // Solo se limpia cuando la campaña entró de verdad. Por eso la acción ya
      // no redirige: con redirect() adentro, esta línea nunca corría.
      localStorage.removeItem(BORRADOR_KEY);
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

      <Field
        label="Título de la campaña"
        name="title"
        placeholder="Reel de brunch de domingo"
        required
      />
      <TextArea
        label="Brief"
        name="brief"
        placeholder="Contá qué querés que el creador muestre: mood, ángulo, momentos clave."
        required
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div className={styles.field}>
          <label htmlFor="budget_amount">Presupuesto (₡)</label>
          <input
            id="budget_amount"
            name="budget_amount"
            type="number"
            required
            value={presupuesto}
            onChange={(e) => setPresupuesto(e.target.value)}
            placeholder="150000"
            className={styles.inp}
          />
        </div>
        <Field label="Plazo (días)" name="deadline_days" type="number" placeholder="15" />
      </div>

      {/* El reparto se ve mientras se decide el monto, que es cuando importa:
          después de publicar, enterarse de cuánto le llega al creador ya no
          cambia nada. Es el mismo bloque que ve el creador en la promo. */}
      {Number(presupuesto) > 0 && (
        <div style={{ marginBottom: "15px" }}>
          <DesglosePago budgetAmount={Number(presupuesto)} audiencia="marca" />
        </div>
      )}

      <Field
        label="Audiencia objetivo"
        name="target_audience"
        placeholder="Food & lifestyle, GAM, 5K+ seguidores"
      />

      <Field
        label="Compensación adicional (opcional)"
        name="compensation_details"
        placeholder="Ej: Cena para 2 personas incluida"
      />

      <div className={styles.field}>
        {/* Sin `htmlFor`: rotula el grupo entero, no una caja en particular. */}
        <label>Entregables — elegí al menos uno</label>
        <div className={`${styles.qtyGrid} ${hayEntregable ? "" : styles.qtyGridFalta}`}>
          {DELIVERABLE_TYPES.map((type) => (
            <label
              key={type}
              htmlFor={`qty_${type}`}
              className={`${styles.qtyRow} ${(qty[type] ?? 0) > 0 ? styles.qtyRowOn : ""}`}
            >
              <span className={styles.qtyName}>{FORMAT_LABEL[type]}</span>
              <input
                id={`qty_${type}`}
                name={`qty_${type}`}
                type="number"
                min={0}
                value={qty[type] ?? 0}
                onChange={(e) =>
                  setQty((prev) => ({ ...prev, [type]: Math.max(0, Number(e.target.value) || 0) }))
                }
                className={styles.qtyInp}
              />
            </label>
          ))}
        </div>
        {!hayEntregable && (
          <p className={styles.fieldHint} style={{ color: "var(--risk)" }}>
            Poné una cantidad mayor a 0 en al menos un formato.
          </p>
        )}
      </div>

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

      {/* Sin verificar, publicar es un botón que solo puede fallar: el gate real
          está en RLS y en la acción. Se muestra como lo que es —el paso que
          viene después— y el borrador pasa a ser la acción principal. */}
      {verified ? (
        <div className={styles.formActions}>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={isPending || !hayEntregable}
            title={hayEntregable ? undefined : "Elegí al menos un entregable"}
            className={`${styles.btn} ${styles.btnGhost}`}
          >
            Guardar borrador
          </button>
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={isPending || !hayEntregable}
            title={hayEntregable ? undefined : "Elegí al menos un entregable"}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {isPending ? "Publicando…" : "Publicar campaña"}
          </button>
        </div>
      ) : (
        <div className={styles.formActions} style={{ flexDirection: "column" }}>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={isPending || !hayEntregable}
            title={hayEntregable ? undefined : "Elegí al menos un entregable"}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {isPending ? "Guardando…" : "Guardar borrador"}
          </button>
          <p className={styles.formNote} style={{ textAlign: "center" }}>
            Vas a poder publicarla apenas verifiquemos tu negocio. Queda lista y la publicás de un
            clic desde la campaña.
          </p>
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className={styles.inp}
      />
    </div>
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
