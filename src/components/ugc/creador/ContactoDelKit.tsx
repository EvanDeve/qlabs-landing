"use client";

import { useActionState, useState } from "react";
import { guardarContactoAction, type GuardarContactoState } from "@/lib/actions/creator-profile";
import { enlacesDeTelefono } from "@/lib/ugc/contacto-kit";
import { useToast } from "@/components/ugc/Toaster";
import Hoja from "./Hoja";
import styles from "@/styles/qos.module.css";

/**
 * El teléfono que el creador ofrece en su media kit (spec 002, RF-06, RF-07).
 *
 * Es una sección aparte del resto del perfil y con su propio botón: el
 * "Guardar" general manda el perfil entero, y si el número viajara ahí, un
 * guardado cualquiera podría vaciarlo.
 */
export default function ContactoDelKit({
  telefono,
  mostrar,
}: {
  telefono: string | null;
  mostrar: boolean;
}) {
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  // Campos controlados: React resetea un form no controlado después de cada
  // envío, y con un error el creador perdía lo que había escrito.
  const [numero, setNumero] = useState(telefono ? enlacesDeTelefono(telefono).legible : "");
  const [visible, setVisible] = useState(mostrar);
  // Cerrar la hoja y avisar va dentro del action y no en un efecto que mira
  // `state`: así pasa una vez por guardado, no en cada render posterior.
  const [state, formAction, pending] = useActionState<GuardarContactoState, FormData>(
    async (prev, formData) => {
      const r = await guardarContactoAction(prev, formData);
      if (r && "ok" in r) {
        toast("Contacto guardado.");
        setAbierta(false);
      }
      return r;
    },
    null
  );

  return (
    <>
      <div className={styles.perfilSeccionHead}>
        <p className={styles.perfilSeccion}>Contacto para marcas</p>
        <button type="button" className={styles.entLink} onClick={() => setAbierta(true)}>
          {telefono ? "Editar" : "Agregar"}
        </button>
      </div>
      {telefono ? (
        <div className={styles.hojaTabla}>
          <div className={styles.perfilFila}>
            <span className={styles.perfilFilaLabel}>Teléfono</span>
            <span className={styles.perfilFilaValor}>{enlacesDeTelefono(telefono).legible}</span>
          </div>
          <div className={styles.perfilFila}>
            <span className={styles.perfilFilaLabel}>En tu kit</span>
            <span className={styles.perfilFilaValor}>{mostrar ? "Visible para marcas" : "Oculto"}</span>
          </div>
        </div>
      ) : (
        <p className={styles.perfilAyuda}>
          Sumá tu teléfono para que una marca verificada te escriba por WhatsApp desde tu kit.
        </p>
      )}

      {abierta && (
        <Hoja
          titulo="Contacto para marcas"
          onClose={() => setAbierta(false)}
          pie={
            <button
              type="submit"
              form="contacto-del-kit"
              className={styles.entEnviar}
              style={{ marginTop: 0 }}
              disabled={pending}
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          }
        >
          <form id="contacto-del-kit" action={formAction}>
            <label className={styles.hojaCampo}>
              <span className={styles.hojaCampoLabel}>Teléfono</span>
              <input
                name="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="8888 7777"
                className={styles.hojaCampoInput}
              />
            </label>
            <p className={styles.perfilAyuda}>
              Si no es de Costa Rica, escribilo con el código de país (+1…). Dejalo vacío para
              borrarlo.
            </p>

            <label className={styles.switchFila} style={{ marginTop: 18 }}>
              <span className={styles.switchTexto}>Mostrar mi teléfono en mi kit</span>
              <input
                type="checkbox"
                name="mostrar_telefono"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
                className={styles.switchInput}
              />
              <span className={styles.switchPista} aria-hidden />
            </label>

            <div className={styles.perfilTip}>
              <b>Quién lo ve</b>
              <span>
                Solo las marcas verificadas, y solo si tocan &quot;Ver teléfono&quot;. Te avisamos
                cuando una lo mira. Lo que ven lo pueden anotar, aunque después lo ocultes.
              </span>
            </div>

            {state && "error" in state && <p className={styles.entError}>{state.error}</p>}
          </form>
        </Hoja>
      )}
    </>
  );
}
