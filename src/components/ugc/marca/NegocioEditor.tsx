"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ugc/Toaster";
import { updateBrandProfileAction, type UpdateBrandProfileState } from "@/lib/actions/brand-profile";
import { BRAND_LOGO_BUCKET, MAX_BRAND_LOGO_FILE_BYTES } from "@/lib/ugc/brand-logos";
import { pesoLegible, subirArchivoDirecto } from "@/lib/ugc/uploads";
import { initialsOf } from "@/components/ugc/BrandAvatar";
import { QosIcon } from "@/lib/ugc/qos-icons";
import Hoja from "@/components/ugc/creador/Hoja";
import styles from "@/styles/qos.module.css";
import PantallaHeader from "@/components/ugc/PantallaHeader";

export type NegocioInicial = {
  brand_name: string;
  industry: string | null;
  location: string | null;
  description: string | null;
  website: string | null;
  instagram_handle: string | null;
  logo_url: string | null;
  verified: boolean;
  slug: string | null;
  admin_nombre: string;
};

type Campo = "brand_name" | "industry" | "location" | "description" | "website" | "instagram_handle";

const ETIQUETA: Record<Campo, string> = {
  brand_name: "Nombre",
  industry: "Industria",
  location: "Zona",
  description: "Descripción",
  website: "Sitio web",
  instagram_handle: "Instagram",
};

/**
 * "Mi negocio": la misma idea que "Mi perfil" del creador — una lista de filas
 * de lectura, y cada dato se edita en su propia hoja.
 *
 * Guardar manda el formulario ENTERO y no solo la fila tocada: el server action
 * ya sabe recibir todo junto, y partirlo en un action por campo serían seis
 * caminos que se desincronizan. Misma decisión que del lado del creador.
 */
export default function NegocioEditor({ inicial }: { inicial: NegocioInicial }) {
  const [estado, formAction, guardando] = useActionState<UpdateBrandProfileState, FormData>(
    updateBrandProfileAction,
    null
  );
  const inputLogo = useRef<HTMLInputElement>(null);

  const [campo, setCampo] = useState<Campo | null>(null);
  const [nombre, setNombre] = useState(inicial.brand_name);
  const [industria, setIndustria] = useState(inicial.industry ?? "");
  const [zona, setZona] = useState(inicial.location ?? "");
  const [descripcion, setDescripcion] = useState(inicial.description ?? "");
  const [sitio, setSitio] = useState(inicial.website ?? "");
  const [instagram, setInstagram] = useState(inicial.instagram_handle ?? "");

  const [logoPath, setLogoPath] = useState("");
  const [logoPreview, setLogoPreview] = useState(inicial.logo_url);
  const [subiendo, setSubiendo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  const toast = useToast();

  // Desde 2026-09-29 nada se guarda solo (lo pidió Evan): cada hoja cierra con
  // "Listo" y lo editado queda pendiente hasta el botón "Guardar cambios" de
  // abajo, que aparece solo si hay algo distinto de lo guardado. `base` es la
  // foto de lo que está en la base; `enviado`, la de lo que se mandó, que pasa
  // a ser la base recién cuando el action dice ok.
  const [base, setBase] = useState(() => ({
    brand_name: inicial.brand_name,
    industry: inicial.industry ?? "",
    location: inicial.location ?? "",
    description: inicial.description ?? "",
    website: inicial.website ?? "",
    instagram_handle: inicial.instagram_handle ?? "",
  }));
  const [enviado, setEnviado] = useState<{ valores: typeof base; logoPath: string } | null>(null);
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (estado && "ok" in estado && enviado) {
      const { valores: v, logoPath: lp } = enviado;
      setBase(v);
      // Si mientras guardaba se eligió OTRO logo, ese sigue pendiente.
      if (logoPath === lp) setLogoPath("");
      setEnviado(null);
    }
  }
  // El aviso va en un toast y no en el render de arriba: dispararlo desde el
  // render lo repetiría en cada repintado.
  useEffect(() => {
    if (estado && "ok" in estado) toast("Cambios guardados.");
  }, [estado, toast]);

  async function cambiarLogo(f: File) {
    setErrorLogo(null);
    if (f.size > MAX_BRAND_LOGO_FILE_BYTES) {
      setErrorLogo(
        `El logo pesa ${pesoLegible(f.size)} y el máximo es ${pesoLegible(MAX_BRAND_LOGO_FILE_BYTES)}.`
      );
      return;
    }
    setSubiendo(true);
    try {
      // Directo a Storage: por el server action el tope real es el body de
      // Vercel (~4.5 MB) y un logo de 4.6 MB moría solo en producción.
      const path = await subirArchivoDirecto({
        bucket: BRAND_LOGO_BUCKET,
        file: f,
        maxBytes: MAX_BRAND_LOGO_FILE_BYTES,
        extFallback: "png",
      });
      // El archivo ya está en Storage; el perfil lo apunta recién con
      // "Guardar cambios", como cualquier otro campo.
      setLogoPath(path);
      setLogoPreview(URL.createObjectURL(f));
    } catch (err) {
      setErrorLogo(err instanceof Error ? err.message : "No se pudo subir el logo.");
    } finally {
      setSubiendo(false);
      if (inputLogo.current) inputLogo.current.value = "";
    }
  }

  /**
   * Se arma el envío a mano con los valores del estado, no leyendo el
   * formulario: los inputs escondidos pueden no haberse repintado todavía, y
   * así fue como se perdió el logo (`0c4a9cd`).
   */
  function guardarCambios() {
    if (guardando) return;
    const v = { ...valores };
    setEnviado({ valores: v, logoPath });
    const datos = new FormData();
    for (const [k, val] of Object.entries(v)) datos.set(k, val);
    datos.set("logo_path", logoPath);
    startTransition(() => formAction(datos));
  }

  const valores: Record<Campo, string> = {
    brand_name: nombre,
    industry: industria,
    location: zona,
    description: descripcion,
    website: sitio,
    instagram_handle: instagram,
  };
  const hayCambios =
    logoPath !== "" || (Object.keys(valores) as Campo[]).some((k) => valores[k] !== base[k]);

  const setter: Record<Campo, (v: string) => void> = {
    brand_name: setNombre,
    industry: setIndustria,
    location: setZona,
    description: setDescripcion,
    website: setSitio,
    instagram_handle: setInstagram,
  };

  const fila = (c: Campo) => (
    <button key={c} type="button" className={styles.perfilFila} onClick={() => setCampo(c)}>
      <span className={styles.perfilFilaLabel}>{ETIQUETA[c]}</span>
      <span className={`${styles.perfilFilaValor} ${valores[c] ? "" : styles.perfilFilaVacio}`}>
        {valores[c] || "Agregar"}
      </span>
      <QosIcon name="chevR" size={14} />
    </button>
  );

  return (
    <>

      <PantallaHeader
        titulo="Mi negocio"
        accion={
          inicial.slug ? (
            <a
              href={`/ugc/marcas/${inicial.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.mcVerPublico}
            >
              Ver público
            </a>
          ) : undefined
        }
      />

      <div className={styles.mcIdent}>
        <input
          ref={inputLogo}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void cambiarLogo(f);
          }}
        />
        <button
          type="button"
          className={styles.mcLogo}
          onClick={() => inputLogo.current?.click()}
          aria-label="Cambiar el logo"
          disabled={subiendo}
        >
          {logoPreview ? (
            // de Storage y es de 64px; `next/image` acá solo suma configuración.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="" className={styles.mcLogoImg} />
          ) : (
            initialsOf(nombre)
          )}
          <span className={styles.mcLogoEditar}>
            <QosIcon name="camera" size={12} />
          </span>
        </button>

        <div className={styles.mcIdentTxt}>
          <div className={styles.mcIdentNombre}>{nombre || "Sin nombre"}</div>
          {inicial.verified && (
            <div className={styles.mcIdentSello}>
              <QosIcon name="check" size={13} />
              Negocio verificado
            </div>
          )}
        </div>
      </div>

      {errorLogo && <p className={styles.entError}>{errorLogo}</p>}
      {estado && "error" in estado && <p className={styles.entError}>{estado.error}</p>}

      <p className={styles.perfilSeccion}>Lo que ven los creadores</p>
      <div className={styles.hojaTabla}>
        {(["brand_name", "industry", "location", "description"] as Campo[]).map(fila)}
      </div>
      <p className={styles.perfilAyuda}>
        La zona es lo primero que mira un creador para saber si puede llegar a grabar.
      </p>

      <p className={styles.perfilSeccion}>Enlaces</p>
      <div className={styles.hojaTabla}>
        {(["website", "instagram_handle"] as Campo[]).map(fila)}
      </div>

      <p className={styles.perfilSeccion}>Cuenta</p>
      <div className={styles.hojaTabla}>
        {/* No es editable desde acá: quién administra sale de `profiles`, que se
            cambia en la cuenta y no en el negocio. Se muestra porque en un
            equipo es el dato que dice a quién preguntarle. */}
        <div className={styles.perfilFila} style={{ cursor: "default" }}>
          <span className={styles.perfilFilaLabel}>Quién administra</span>
          <span className={styles.perfilFilaValor}>{inicial.admin_nombre}</span>
        </div>
      </div>

      {campo && (
        <Hoja
          titulo={ETIQUETA[campo]}
          bajada={
            campo === "description"
              ? "Dos o tres líneas: qué se come, qué se siente, para quién es."
              : campo === "location"
                ? "Barrio y ciudad, como se lo dirías a alguien que va a manejar hasta ahí."
                : null
          }
          onClose={() => setCampo(null)}
          pie={
            <button
              type="button"
              onClick={() => setCampo(null)}
              className={`${styles.trBoton} ${styles.trBotonPrim}`}
              style={{ marginTop: 0 }}
            >
              Listo
            </button>
          }
        >
          <label className={styles.hojaCampoLabel} htmlFor={`campo-${campo}`}>
            {ETIQUETA[campo]}
          </label>
          {campo === "description" ? (
            <textarea
              id={`campo-${campo}`}
              value={valores[campo]}
              onChange={(e) => setter[campo](e.target.value)}
              className={styles.perfilTextarea}
              rows={4}
            />
          ) : (
            <input
              id={`campo-${campo}`}
              value={valores[campo]}
              onChange={(e) => setter[campo](e.target.value)}
              className={styles.hojaCampoInput}
              inputMode={campo === "website" ? "url" : "text"}
              placeholder={
                campo === "website"
                  ? "loshiguerones.cr"
                  : campo === "instagram_handle"
                    ? "loshiguerones"
                    : ""
              }
            />
          )}
        </Hoja>
      )}

      {/* Solo cuando hay algo sin guardar: un botón siempre a la vista
          diciendo "Guardar" sin nada que guardar no dice nada. */}
      {hayCambios && (
        <>
          <div className={styles.trPieAire} />
          <div className={styles.trPie}>
            <button type="button" onClick={guardarCambios} disabled={guardando} className={styles.trPiePill}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
