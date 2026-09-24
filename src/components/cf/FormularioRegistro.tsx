"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { registroAction, type EstadoRegistro } from "@/lib/actions/close-friends";
import { BOTON, BOTON_SUAVE, CAMPO, Casilla, CampoCodigo, MensajeError } from "@/components/cf/ui";
import { CF } from "@/lib/cf/copy";

/** Lo que dura el freno de Supabase entre dos códigos al mismo correo. */
const ESPERA_REENVIO_S = 60;

type Valores = {
  full_name: string;
  phone: string;
  email: string;
  birthdate: string;
  agent_name: string;
  acepta_terminos: boolean;
  comparte_con_marca: boolean;
  whatsapp: boolean;
};

const VACIO: Valores = {
  full_name: "",
  phone: "",
  email: "",
  birthdate: "",
  agent_name: "",
  acepta_terminos: false,
  comparte_con_marca: false,
  whatsapp: false,
};

/**
 * El alta de Close Friends. Dos pasos en la misma pantalla y con un solo
 * estado: los datos, y después el código que llega por correo.
 *
 * Los valores viven en el estado del componente y no en los inputs, por dos
 * motivos: "Cambiar correo" vuelve al paso de datos con todo lo escrito, y el
 * paso del código reenvía los mismos datos en campos ocultos — el servidor no
 * los guarda entre un paso y otro.
 */
export default function FormularioRegistro({ codigo, negocio }: { codigo: string; negocio: string }) {
  const [estado, accion, enviando] = useActionState<EstadoRegistro, FormData>(registroAction, { paso: "datos" });
  const [v, setV] = useState<Valores>(VACIO);
  // El paso lo decide el servidor, salvo "Cambiar correo", que es solo volver.
  const [volviAtras, setVolviAtras] = useState(false);
  const paso = volviAtras ? "datos" : estado.paso;

  const set = <K extends keyof Valores>(k: K) => (valor: Valores[K]) => setV((prev) => ({ ...prev, [k]: valor }));

  // Cuenta regresiva para "Reenviar", desde que el servidor mandó el código.
  // El reloj avanza con un intervalo; la espera se calcula, no se guarda.
  const [ahora, setAhora] = useState(() => Date.now());
  const enCodigo = estado.paso === "codigo";
  useEffect(() => {
    if (!enCodigo) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enCodigo]);
  const espera =
    estado.paso === "codigo"
      ? Math.max(0, ESPERA_REENVIO_S - Math.floor((ahora - estado.enviadoEn) / 1000))
      : 0;

  // Todo envío vuelve a dejar que el servidor decida el paso.
  const enviar = (fd: FormData) => {
    setVolviAtras(false);
    setAhora(Date.now());
    accion(fd);
  };

  const ocultos = (
    <>
      <input type="hidden" name="codigo" value={codigo} />
      {(["full_name", "phone", "email", "birthdate", "agent_name"] as const).map((k) => (
        <input key={k} type="hidden" name={k} value={v[k]} />
      ))}
      {(["acepta_terminos", "comparte_con_marca", "whatsapp"] as const).map((k) =>
        v[k] ? <input key={k} type="hidden" name={k} value="on" /> : null
      )}
    </>
  );

  if (paso === "codigo" && estado.paso === "codigo") {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Revisá tu correo</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          Te mandamos un código a <b className="text-ink">{estado.email}</b>. Puede tardar un
          minuto; si no lo ves, mirá en correo no deseado.
        </p>

        <form action={enviar} className="mt-8 flex flex-col gap-4">
          {ocultos}
          <input type="hidden" name="paso" value="codigo" />
          <CampoCodigo error={Boolean(estado.error)} />
          <MensajeError>{estado.error}</MensajeError>
          {estado.aviso && !estado.error && (
            <p className="text-center text-[15px] font-semibold text-trust">{estado.aviso}</p>
          )}
          <button type="submit" disabled={enviando} className={BOTON}>
            {enviando ? "Confirmando…" : "Confirmar"}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2">
          <form action={enviar}>
            {ocultos}
            <input type="hidden" name="paso" value="reenviar" />
            <button type="submit" disabled={espera > 0 || enviando} className={BOTON_SUAVE}>
              {espera > 0 ? `Reenviar código en ${espera} s` : "Reenviar código"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setVolviAtras(true)}
            className="min-h-11 text-[15px] font-semibold text-ink-soft transition hover:text-violet"
          >
            Cambiar correo o datos
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="paso" value="datos" />

      <Campo etiqueta="Nombre completo">
        <input
          name="full_name"
          autoComplete="name"
          required
          maxLength={80}
          value={v.full_name}
          onChange={(e) => set("full_name")(e.target.value)}
          className={CAMPO}
        />
      </Campo>

      <Campo etiqueta="WhatsApp">
        <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-white transition focus-within:border-violet">
          <span className="flex items-center border-r border-line bg-lavender px-3 text-base font-semibold text-ink-soft">
            +506
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            placeholder="8888 7777"
            value={v.phone}
            onChange={(e) => set("phone")(e.target.value)}
            className="min-h-12 w-full px-4 text-base text-ink outline-none placeholder:text-ink-soft/60"
          />
        </div>
      </Campo>

      <Campo etiqueta="Correo" ayuda="Ahí te llega el código para confirmar.">
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          value={v.email}
          onChange={(e) => set("email")(e.target.value)}
          className={CAMPO}
        />
      </Campo>

      <Campo etiqueta="Fecha de nacimiento" ayuda={`${CF.programa} es para mayores de 18 años.`}>
        <input
          name="birthdate"
          type="date"
          required
          value={v.birthdate}
          onChange={(e) => set("birthdate")(e.target.value)}
          className={`${CAMPO} appearance-none`}
        />
      </Campo>

      <Campo
        etiqueta="Nombre de agente"
        ayuda={`Tu alias en ${CF.programa}. Es lo que ven los negocios si no les compartís tus datos. Letras, números, punto o guion bajo.`}
      >
        <input
          name="agent_name"
          autoComplete="nickname"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü._]{3,20}"
          placeholder="agente.007"
          value={v.agent_name}
          onChange={(e) => set("agent_name")(e.target.value)}
          className={CAMPO}
        />
      </Campo>

      <div className="mt-2 flex flex-col gap-2">
        <Casilla
          name="acepta_terminos"
          required
          checked={v.acepta_terminos}
          onChange={set("acepta_terminos")}
          ayuda="Tus datos se guardan en servidores fuera de Costa Rica (Supabase y Vercel)."
        >
          Acepto los{" "}
          <Link href="/legal/terminos#close-friends" target="_blank" className="font-bold text-violet underline">
            términos
          </Link>{" "}
          y la{" "}
          <Link href="/legal/privacidad" target="_blank" className="font-bold text-violet underline">
            política de privacidad
          </Link>
          .
        </Casilla>
        <Casilla
          name="comparte_con_marca"
          checked={v.comparte_con_marca}
          onChange={set("comparte_con_marca")}
          ayuda={`Opcional. Si no la marcás, ${negocio} te ve solo por tu nombre de agente.`}
        >
          Compartir mi nombre y contacto con {negocio}
        </Casilla>
        <Casilla name="whatsapp" checked={v.whatsapp} onChange={set("whatsapp")} ayuda="Opcional. Lo podés apagar cuando quieras.">
          Recibir avisos de ofertas y eventos por WhatsApp
        </Casilla>
      </div>

      <MensajeError>{estado.paso === "datos" ? estado.error : undefined}</MensajeError>

      <button type="submit" disabled={enviando} className={`${BOTON} mt-2`}>
        {enviando ? "Enviando…" : "Enviarme el código"}
      </button>
    </form>
  );
}

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[15px] font-bold text-ink">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-[13px] leading-snug text-ink-soft">{ayuda}</span>}
    </label>
  );
}
