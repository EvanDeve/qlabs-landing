"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { verTelefonoAction } from "@/lib/actions/kit";
import { enlacesDeTelefono, type ModoContacto } from "@/lib/ugc/contacto-kit";

/**
 * El contacto directo del media kit (spec 002, RF-08..RF-12).
 *
 * El número NO viene en el HTML de la página: para una marca verificada se
 * pide al tocar "Ver teléfono", y ese pedido es el que le avisa al creador.
 * El único caso en que llega armado es el del dueño mirando su propio kit.
 */
export default function KitContacto({
  modo,
  creadorId,
  telefonoPropio,
}: {
  modo: ModoContacto;
  creadorId: string;
  telefonoPropio: string | null;
}) {
  const [telefono, setTelefono] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, startPedir] = useTransition();

  if (modo === "nada") return null;

  function ver() {
    setError(null);
    startPedir(async () => {
      const r = await verTelefonoAction(creadorId);
      if ("error" in r) setError(r.error);
      else setTelefono(r.telefono);
    });
  }

  const numero = modo === "propio" ? telefonoPropio : telefono;

  return (
    <section className="mt-8 rounded-card border border-line bg-white p-5">
      <h2 className="text-base font-extrabold text-ink">Contacto para marcas</h2>

      {numero ? (
        <NumeroConAcciones numero={numero} />
      ) : modo === "ver" ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">Escribile directo por WhatsApp o llamalo.</p>
          <button
            type="button"
            onClick={ver}
            disabled={pidiendo}
            className="mt-4 w-full rounded-pill bg-violet px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
          >
            {pidiendo ? "Cargando…" : "Ver teléfono"}
          </button>
          {error && <p className="mt-2 text-sm font-semibold text-coral">{error}</p>}
        </>
      ) : modo === "pedir-sesion" ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Su teléfono lo ven las marcas verificadas en UGC·CRC.
          </p>
          <Link
            href="/ugc/login?intent=marca"
            className="mt-4 block w-full rounded-pill bg-violet px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-violet-deep"
          >
            Entrá o registrate como marca
          </Link>
        </>
      ) : modo === "marca-sin-verificar" ? (
        <p className="mt-1 text-sm text-ink-soft">
          Su teléfono lo ven las marcas verificadas. Apenas Q Labs verifique tu negocio, lo vas a
          poder ver acá.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">El contacto directo es solo para marcas.</p>
      )}

      {modo === "propio" && (
        <p className="mt-3 text-xs text-ink-soft">
          Así lo ve una marca verificada después de tocar &quot;Ver teléfono&quot;. Nadie más lo ve.
        </p>
      )}
    </section>
  );
}

function NumeroConAcciones({ numero }: { numero: string }) {
  const { legible, whatsapp, llamar } = enlacesDeTelefono(numero);
  return (
    <>
      <p className="mt-2 text-xl font-extrabold tracking-tight text-ink">{legible}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-pill bg-trust px-4 py-3 text-center text-sm font-bold text-white transition hover:opacity-90"
        >
          <i className="fa-brands fa-whatsapp mr-1.5" aria-hidden />
          WhatsApp
        </a>
        <a
          href={llamar}
          className="rounded-pill border border-line bg-white px-4 py-3 text-center text-sm font-bold text-ink transition hover:border-violet hover:text-violet"
        >
          <i className="fa-solid fa-phone mr-1.5" aria-hidden />
          Llamar
        </a>
      </div>
    </>
  );
}
