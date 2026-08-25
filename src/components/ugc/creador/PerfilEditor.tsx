"use client";

import { useActionState, useRef, useState } from "react";
import {
  updateCreatorProfileDetailsAction,
  type UpdateCreatorProfileDetailsState,
} from "@/lib/actions/creator-profile";
import { LANGUAGE_OPTIONS } from "@/lib/ugc/languages";
import { AVATAR_BUCKET, MAX_AVATAR_FILE_BYTES } from "@/lib/ugc/avatars";
import { pesoLegible, subirArchivoDirecto } from "@/lib/ugc/uploads";
import { displayHandle } from "@/lib/ugc/handles";
import { MAX_BIO } from "@/lib/ugc/perfil";
import { QosIcon } from "@/lib/ugc/qos-icons";
import CompartirPerfil from "./CompartirPerfil";
import Hoja from "./Hoja";
import styles from "@/styles/qos.module.css";

export type PerfilInicial = {
  handle: string;
  verified: boolean;
  bio: string;
  city: string;
  followers_count: number;
  niches: string[];
  languages: string[];
  instagram_handle: string;
  tiktok_handle: string;
  avatar_url: string | null;
};

type Skill = { name: string; level: number };
type PastBrand = { category: string; brand_name: string };

/** Qué fila está abierta en su hoja. `null` = ninguna. */
type Campo = "bio" | "city" | "followers" | "instagram" | "tiktok" | "niches" | "skills" | "brands";

const TITULO: Record<Campo, string> = {
  bio: "Tu bio",
  city: "Tu ciudad",
  followers: "Tus seguidores",
  instagram: "Tu Instagram",
  tiktok: "Tu TikTok",
  niches: "Tus nichos",
  skills: "Tus habilidades",
  brands: "Marcas con las que trabajaste",
};

export default function PerfilEditor({
  inicial,
  skillsIniciales,
  marcasIniciales,
}: {
  inicial: PerfilInicial;
  skillsIniciales: Skill[];
  marcasIniciales: PastBrand[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<UpdateCreatorProfileDetailsState, FormData>(
    updateCreatorProfileDetailsAction,
    null
  );

  const [bio, setBio] = useState(inicial.bio);
  const [city, setCity] = useState(inicial.city);
  const [followers, setFollowers] = useState(String(inicial.followers_count || ""));
  const [instagram, setInstagram] = useState(inicial.instagram_handle);
  const [tiktok, setTiktok] = useState(inicial.tiktok_handle);
  const [niches, setNiches] = useState<string[]>(inicial.niches);
  const [languages, setLanguages] = useState<string[]>(
    inicial.languages.length > 0 ? inicial.languages : ["es"]
  );
  const [skills, setSkills] = useState<Skill[]>(skillsIniciales);
  const [marcas, setMarcas] = useState<PastBrand[]>(marcasIniciales);
  const [campo, setCampo] = useState<Campo | null>(null);
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(inicial.avatar_url);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  async function cambiarFoto(f: File) {
    setErrorFoto(null);
    if (f.size > MAX_AVATAR_FILE_BYTES) {
      setErrorFoto(`La foto pesa ${pesoLegible(f.size)} y el máximo es ${pesoLegible(MAX_AVATAR_FILE_BYTES)}.`);
      return;
    }
    setSubiendoFoto(true);
    try {
      const path = await subirArchivoDirecto({
        bucket: AVATAR_BUCKET,
        file: f,
        maxBytes: MAX_AVATAR_FILE_BYTES,
        extFallback: "jpg",
      });
      setAvatarPath(path);
      setAvatarPreview(URL.createObjectURL(f));
      // Se guarda de una: cambiar la foto es un gesto completo en sí mismo, y
      // dejarla "pendiente de guardar" sin un botón a la vista se pierde.
      setTimeout(() => formRef.current?.requestSubmit(), 0);
    } catch (err) {
      setErrorFoto(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  /**
   * Guardar manda el formulario ENTERO, no solo la fila que se tocó.
   *
   * El server action ya sabe recibir todo junto y reemplazar habilidades y
   * marcas de una; partirlo en un action por campo serían seis caminos nuevos
   * que pueden desincronizarse. Además así cada guardado escribe una foto
   * consistente de lo que el creador está viendo.
   */
  function guardar() {
    setCampo(null);
    formRef.current?.requestSubmit();
  }

  const filas: { campo: Campo; etiqueta: string; valor: string; vacio?: boolean }[] = [
    { campo: "bio", etiqueta: "Bio", valor: bio || "Agregar", vacio: !bio },
    { campo: "city", etiqueta: "Ciudad", valor: city || "Agregar", vacio: !city },
    {
      campo: "followers",
      etiqueta: "Seguidores",
      valor: inicial.followers_count > 0 || followers ? Number(followers || 0).toLocaleString("es-CR") : "Agregar",
      vacio: !followers,
    },
    { campo: "instagram", etiqueta: "Instagram", valor: instagram || "Agregar", vacio: !instagram },
    { campo: "tiktok", etiqueta: "TikTok", valor: tiktok || "Agregar", vacio: !tiktok },
  ];

  return (
    <>
      <form ref={formRef} action={formAction}>
        {/* Todo viaja en inputs escondidos: las filas son de lectura y quien
            edita es la hoja, pero el formulario tiene que mandar el estado
            completo en cada guardado. */}
        <input type="hidden" name="avatar_path" value={avatarPath} />
        <input type="hidden" name="bio" value={bio} />
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="followers_count" value={followers || "0"} />
        <input type="hidden" name="instagram_handle" value={instagram} />
        <input type="hidden" name="tiktok_handle" value={tiktok} />
        <input type="hidden" name="niches" value={niches.join(", ")} />
        {languages.map((c) => (
          <input key={c} type="hidden" name="languages" value={c} />
        ))}
        {skills.map((s, i) => (
          <span key={`s${i}`}>
            <input type="hidden" name="skill_name" value={s.name} />
            <input type="hidden" name="skill_level" value={s.level} />
          </span>
        ))}
        {marcas.map((m, i) => (
          <span key={`m${i}`}>
            <input type="hidden" name="brand_category" value={m.category} />
            <input type="hidden" name="brand_name" value={m.brand_name} />
          </span>
        ))}

        <div className={styles.perfilIdentidad}>
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void cambiarFoto(f);
            }}
          />
          <button
            type="button"
            className={styles.perfilAvatar}
            onClick={() => fotoRef.current?.click()}
            aria-label="Cambiar la foto de perfil"
            disabled={subiendoFoto}
          >
            {avatarPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className={styles.perfilAvatarImg} />
            )}
            <span className={styles.perfilAvatarEditar} aria-hidden>
              <QosIcon name="camera" size={11} />
            </span>
          </button>
          <div className={styles.perfilIdentTexto}>
            <div className={styles.perfilIdentHandle}>
              {displayHandle(inicial.handle)}
              {inicial.verified && (
                <span className={styles.perfilTilde} title="Verificado por Q Labs">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5.5 5.5L20 7" />
                  </svg>
                </span>
              )}
            </div>
            <div className={styles.perfilIdentSub}>
              {inicial.verified ? "Verificado a mano por Q Labs" : "Todavía sin verificar"}
            </div>
          </div>
          <CompartirPerfil handle={inicial.handle} />
        </div>

        <p className={styles.perfilSeccion}>Lo que ven las marcas</p>
        <div className={styles.hojaTabla}>
          {filas.map((f) => (
            <button
              key={f.campo}
              type="button"
              className={styles.perfilFila}
              onClick={() => setCampo(f.campo)}
            >
              <span className={styles.perfilFilaLabel}>{f.etiqueta}</span>
              <span className={`${styles.perfilFilaValor} ${f.vacio ? styles.perfilFilaVacio : ""}`}>
                {f.valor}
              </span>
              <QosIcon name="chevR" size={14} />
            </button>
          ))}
        </div>

        <div className={styles.perfilSeccionHead}>
          <p className={styles.perfilSeccion}>Nichos</p>
          <button type="button" className={styles.entLink} onClick={() => setCampo("niches")}>
            Editar
          </button>
        </div>
        <div className={styles.platChips}>
          {niches.map((n) => (
            <span key={n} className={styles.platChip}>
              {n}
            </span>
          ))}
          <button
            type="button"
            className={`${styles.platChip} ${styles.perfilChipAgregar}`}
            onClick={() => setCampo("niches")}
          >
            + Agregar
          </button>
        </div>

        <p className={styles.perfilSeccion}>Idiomas para grabar</p>
        <div className={styles.platChips}>
          {LANGUAGE_OPTIONS.map((l) => {
            const on = languages.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setLanguages((prev) =>
                    // Nunca se queda sin ninguno: un perfil sin idioma no le
                    // dice nada a la marca que busca por idioma.
                    on
                      ? prev.length > 1
                        ? prev.filter((c) => c !== l.code)
                        : prev
                      : [...prev, l.code]
                  )
                }
                className={`${styles.platChip} ${on ? styles.platChipOn : ""}`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
        <p className={styles.perfilAyuda}>
          Marcá inglés solo si podés grabar en ese idioma — los hoteles lo buscan.
        </p>

        <div className={styles.perfilSeccionHead}>
          <p className={styles.perfilSeccion}>Habilidades</p>
          <button type="button" className={styles.entLink} onClick={() => setCampo("skills")}>
            {skills.length > 0 ? "Editar" : "Agregar"}
          </button>
        </div>
        {skills.length > 0 ? (
          <div className={styles.hojaTabla}>
            {skills.map((s) => (
              <div key={s.name} className={styles.perfilFila}>
                <span className={styles.perfilFilaLabel}>{s.name}</span>
                <span className={styles.perfilNivel} aria-label={`Nivel ${s.level} de 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= s.level ? styles.perfilNivelOn : undefined} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.perfilAyuda}>
            Programación, edición de video, fotografía… lo que sepas hacer además de grabar.
          </p>
        )}

        <div className={styles.perfilSeccionHead}>
          <p className={styles.perfilSeccion}>Marcas con las que trabajaste</p>
          <button type="button" className={styles.entLink} onClick={() => setCampo("brands")}>
            {marcas.length > 0 ? "Editar" : "Agregar"}
          </button>
        </div>
        {marcas.length > 0 && (
          <div className={styles.hojaTabla}>
            {marcas.map((m, i) => (
              <div key={`${m.brand_name}${i}`} className={styles.perfilFila}>
                <span className={styles.perfilFilaLabel}>{m.brand_name}</span>
                <span className={styles.perfilFilaValor}>{m.category}</span>
              </div>
            ))}
          </div>
        )}

        {errorFoto && <p className={styles.entError}>{errorFoto}</p>}
        {subiendoFoto && <p className={styles.perfilAyuda}>Subiendo la foto…</p>}
        {state && "error" in state && <p className={styles.entError}>{state.error}</p>}
        {state && "ok" in state && <p className={styles.perfilOk}>Listo, se guardó.</p>}
        {pending && <p className={styles.perfilAyuda}>Guardando…</p>}
      </form>

      {campo && (
        <Hoja
          titulo={TITULO[campo]}
          onClose={() => setCampo(null)}
          pie={
            <button type="button" className={styles.entEnviar} style={{ marginTop: 0 }} onClick={guardar}>
              Guardar
            </button>
          }
        >
          {campo === "bio" && (
            <>
              <textarea
                autoFocus
                rows={4}
                maxLength={MAX_BIO}
                value={bio}
                // Se recorta acá y no solo con `maxLength`: ese atributo frena
                // el tecleo pero no siempre un pegado, y el contador quedaba
                // diciendo "200/160" sobre un texto que el servidor iba a
                // recortar sin avisar.
                onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
                placeholder="Contá quién sos y qué contenido hacés."
                className={styles.perfilTextarea}
              />
              <div className={styles.perfilContador}>
                <span>Contá quién sos y qué contenido hacés.</span>
                <span className={bio.length >= MAX_BIO ? styles.perfilContadorTope : undefined}>
                  {bio.length}/{MAX_BIO}
                </span>
              </div>
              <div className={styles.perfilTip}>
                <b>Lo que mejor funciona</b>
                <span>Decí qué grabás y dónde. Las marcas buscan por zona y por tipo de contenido.</span>
              </div>
            </>
          )}

          {campo === "city" && (
            <label className={styles.hojaCampo}>
              <span className={styles.hojaCampoLabel}>Ciudad</span>
              <input
                autoFocus
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Heredia"
                className={styles.hojaCampoInput}
              />
            </label>
          )}

          {campo === "followers" && (
            <>
              <label className={styles.hojaCampo}>
                <span className={styles.hojaCampoLabel}>Seguidores</span>
                <input
                  autoFocus
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={followers}
                  onChange={(e) => setFollowers(e.target.value)}
                  placeholder="20000"
                  className={styles.hojaCampoInput}
                />
              </label>
              <p className={styles.perfilAyuda}>
                Sumá tus redes principales. Es lo primero que mira una marca para saber si le
                servís.
              </p>
            </>
          )}

          {(campo === "instagram" || campo === "tiktok") && (
            <label className={styles.hojaCampo}>
              <span className={styles.hojaCampoLabel}>
                {campo === "instagram" ? "Instagram" : "TikTok"}
              </span>
              <input
                autoFocus
                value={campo === "instagram" ? instagram : tiktok}
                onChange={(e) =>
                  campo === "instagram" ? setInstagram(e.target.value) : setTiktok(e.target.value)
                }
                placeholder="@tu.usuario"
                className={styles.hojaCampoInput}
              />
            </label>
          )}

          {campo === "niches" && <EditorLista valores={niches} onCambio={setNiches} placeholder="food" />}

          {campo === "skills" && <EditorHabilidades skills={skills} onCambio={setSkills} />}

          {campo === "brands" && <EditorMarcas marcas={marcas} onCambio={setMarcas} />}
        </Hoja>
      )}
    </>
  );
}

/** Lista de textos sueltos (los nichos): agregar, quitar. */
function EditorLista({
  valores,
  onCambio,
  placeholder,
}: {
  valores: string[];
  onCambio: (v: string[]) => void;
  placeholder: string;
}) {
  const [nuevo, setNuevo] = useState("");

  function agregar() {
    const v = nuevo.trim().toLowerCase();
    // Sin repetidos: dos chips iguales no aportan y ensucian el perfil público.
    if (!v || valores.includes(v)) return;
    onCambio([...valores, v]);
    setNuevo("");
  }

  return (
    <>
      <div className={styles.platChips}>
        {valores.map((v) => (
          <button
            key={v}
            type="button"
            className={`${styles.platChip} ${styles.perfilChipQuitar}`}
            onClick={() => onCambio(valores.filter((x) => x !== v))}
          >
            {v}
            <QosIcon name="x" size={11} />
          </button>
        ))}
      </div>
      <div className={styles.perfilAgregarFila}>
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Sin esto, Enter manda el formulario de afuera y la hoja se
              // cierra a mitad de camino.
              e.preventDefault();
              agregar();
            }
          }}
          placeholder={placeholder}
          className={styles.perfilAgregarInput}
        />
        <button type="button" className={styles.perfilAgregarBtn} onClick={agregar}>
          Agregar
        </button>
      </div>
      <p className={styles.perfilAyuda}>Tocá un nicho para sacarlo.</p>
    </>
  );
}

function EditorHabilidades({
  skills,
  onCambio,
}: {
  skills: Skill[];
  onCambio: (s: Skill[]) => void;
}) {
  const [nombre, setNombre] = useState("");

  return (
    <>
      {skills.map((s, i) => (
        <div key={i} className={styles.perfilSkillFila}>
          <span className={styles.perfilFilaLabel}>{s.name}</span>
          {/* El nivel se toca, no se escribe: cinco puntitos son cinco toques y
              un número en un input es un teclado abierto en el medio. */}
          <span className={styles.perfilNivelEdit}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Nivel ${n}`}
                className={n <= s.level ? styles.perfilNivelOn : undefined}
                onClick={() =>
                  onCambio(skills.map((x, j) => (j === i ? { ...x, level: n } : x)))
                }
              />
            ))}
          </span>
          <button
            type="button"
            className={styles.entLinkGris}
            onClick={() => onCambio(skills.filter((_, j) => j !== i))}
          >
            Quitar
          </button>
        </div>
      ))}
      <div className={styles.perfilAgregarFila}>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Edición de video"
          className={styles.perfilAgregarInput}
        />
        <button
          type="button"
          className={styles.perfilAgregarBtn}
          onClick={() => {
            const v = nombre.trim();
            if (!v) return;
            onCambio([...skills, { name: v, level: 3 }]);
            setNombre("");
          }}
        >
          Agregar
        </button>
      </div>
    </>
  );
}

function EditorMarcas({
  marcas,
  onCambio,
}: {
  marcas: PastBrand[];
  onCambio: (m: PastBrand[]) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("");

  return (
    <>
      {marcas.map((m, i) => (
        <div key={i} className={styles.perfilSkillFila}>
          <span className={styles.perfilFilaLabel}>{m.brand_name}</span>
          <span className={styles.perfilFilaValor}>{m.category}</span>
          <button
            type="button"
            className={styles.entLinkGris}
            onClick={() => onCambio(marcas.filter((_, j) => j !== i))}
          >
            Quitar
          </button>
        </div>
      ))}
      <label className={styles.hojaCampo}>
        <span className={styles.hojaCampoLabel}>Marca</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Kosta Asiatika"
          className={styles.hojaCampoInput}
        />
      </label>
      <div className={styles.perfilAgregarFila}>
        <input
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Restaurante"
          className={styles.perfilAgregarInput}
        />
        <button
          type="button"
          className={styles.perfilAgregarBtn}
          onClick={() => {
            const n = nombre.trim();
            const r = rubro.trim();
            if (!n || !r) return;
            onCambio([...marcas, { brand_name: n, category: r }]);
            setNombre("");
            setRubro("");
          }}
        >
          Agregar
        </button>
      </div>
      <p className={styles.perfilAyuda}>Las dos cosas hacen falta: la marca y de qué es.</p>
    </>
  );
}
