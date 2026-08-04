"use client";

import { useMemo, useState } from "react";
import { diaCR, horaCR, diaCorto } from "@/lib/ugc/calendar";
import { porDia, type Conversacion, type MensajeChat } from "@/lib/ugc/conversaciones";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * Las conversaciones de McLovin, con la forma de WhatsApp y los colores de Q·OS.
 *
 * Se copia la geometría —dos paneles, burbujas con cola, hora adentro abajo a
 * la derecha, separadores por día, tildes de estado— porque es la que el equipo
 * ya sabe leer sin que nadie le explique nada. Lo que no se copia es la paleta:
 * el verde de WhatsApp en medio del panel violeta se vería como una captura
 * pegada, no como una pantalla del producto.
 *
 * Es de solo lectura. WhatsApp solo permite texto libre dentro de las 24 h
 * desde el último mensaje de la persona, así que un campo de escribir andaría a
 * veces sí y a veces no; el pie del hilo lo dice en vez de esconderlo.
 */
export default function ChatView({
  conversaciones,
  nombreAgente,
}: {
  conversaciones: Conversacion[];
  nombreAgente: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(conversaciones[0]?.id ?? null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todo" | "equipo" | "externo">("todo");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return conversaciones.filter((c) => {
      if (filtro !== "todo" && c.procedencia !== filtro) return false;
      if (!q) return true;
      // Se busca también dentro de los mensajes: en un hilo del cron todos los
      // títulos son iguales y lo que uno recuerda es lo que se dijo.
      return (
        c.titulo.toLowerCase().includes(q) ||
        (c.telefono ?? "").includes(q) ||
        c.mensajes.some((m) => m.body.toLowerCase().includes(q))
      );
    });
  }, [conversaciones, busqueda, filtro]);

  const actual = conversaciones.find((c) => c.id === selectedId) ?? null;

  return (
    <div className={styles.workspace}>
      <aside
        className={`${styles.wsPanel} ${styles.wsPanelSide} ${styles.chatList} ${
          actual ? styles.chatListConAbierto : ""
        }`}
      >
        <div className={styles.wsHead}>
          <span className={styles.wsTitle}>Conversaciones</span>
          <span className={styles.kcCount}>{visibles.length}</span>
        </div>

        <div className={styles.chatFiltros}>
          <div className={styles.chatBuscar}>
            <QosIcon name="search" size={14} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en las conversaciones"
              aria-label="Buscar en las conversaciones"
            />
          </div>
          <div className={styles.chatTabs}>
            {(["todo", "equipo", "externo"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`${styles.chatTab} ${filtro === f ? styles.chatTabOn : ""}`}
              >
                {f === "todo" ? "Todas" : f === "equipo" ? "Equipo" : "Externos"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.wsBody}>
          {visibles.length === 0 ? (
            <p className={styles.chatVacioLista}>
              {conversaciones.length === 0
                ? `Todavía no hay conversaciones. Van a aparecer acá apenas ${nombreAgente} mande o reciba un mensaje.`
                : "Nada coincide con esa búsqueda."}
            </p>
          ) : (
            visibles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`${styles.chatRow} ${c.id === selectedId ? styles.chatRowOn : ""}`}
              >
                <Avatar conversacion={c} />
                <span className={styles.chatRowTexto}>
                  <span className={styles.chatRowTop}>
                    <span className={styles.chatRowNombre}>{c.titulo}</span>
                    <span className={styles.chatRowHora}>{fechaCorta(c.ultimoMensaje.createdAt)}</span>
                  </span>
                  <span className={styles.chatRowBottom}>
                    <span className={styles.chatRowPreview}>
                      {c.ultimoMensaje.direction === "out" && <QosIcon name="check" size={11} />}
                      {c.ultimoMensaje.body}
                    </span>
                    <Etiqueta procedencia={c.procedencia} />
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section
        className={`${styles.wsPanel} ${styles.wsPanelMain} ${styles.chatPane} ${
          actual ? "" : styles.chatPaneVacio
        }`}
      >
        {!actual ? (
          <div className={styles.chatVacio}>
            <QosIcon name="chat" size={28} />
            <p>Elegí una conversación para leerla.</p>
          </div>
        ) : (
          <>
            <div className={styles.wsHead}>
              {/* Solo se ve en pantalla angosta, donde la lista y el hilo no
                  caben a la vez. */}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className={styles.chatVolver}
                aria-label="Volver a la lista"
              >
                <QosIcon name="chevL" size={16} />
              </button>
              <Avatar conversacion={actual} />
              <div style={{ minWidth: 0 }}>
                <div className={styles.wsTitle}>{actual.titulo}</div>
                <div className={styles.chatSub}>
                  {actual.telefono ?? "sin número guardado"} · {actual.mensajes.length} mensajes
                </div>
              </div>
              <span style={{ marginLeft: "auto" }}>
                <Etiqueta procedencia={actual.procedencia} />
              </span>
            </div>

            <div className={`${styles.wsBody} ${styles.chatHilo}`}>
              {porDia(actual.mensajes, diaCR).map((grupo) => (
                <div key={grupo.dia}>
                  <div className={styles.chatDia}>
                    <span>{etiquetaDeDia(grupo.dia)}</span>
                  </div>
                  {grupo.mensajes.map((m) => (
                    <Burbuja key={m.id} mensaje={m} />
                  ))}
                </div>
              ))}
            </div>

            {/* En lugar del campo de escribir: por qué no está. */}
            <div className={styles.chatPie}>
              <QosIcon name="alert" size={14} />
              <span>
                Solo lectura. WhatsApp únicamente deja escribir texto libre dentro de las 24 h del último
                mensaje de la persona — responder desde acá es otra épica.
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Burbuja({ mensaje }: { mensaje: MensajeChat }) {
  const propio = mensaje.direction === "out";
  const fallo = mensaje.status === "failed";

  return (
    <div className={`${styles.chatFila} ${propio ? styles.chatFilaPropio : ""}`}>
      <div className={`${styles.chatBurbuja} ${propio ? styles.chatBurbujaPropia : ""} ${fallo ? styles.chatBurbujaFallo : ""}`}>
        <span className={styles.chatCuerpo}>{mensaje.body}</span>
        <span className={styles.chatMeta}>
          {/* Una plantilla es el recordatorio automático de la mañana, no algo
              que alguien escribió: vale la pena poder distinguirlo de un vistazo. */}
          {mensaje.plantilla && <span className={styles.chatPlantilla}>automático</span>}
          <span>{horaCR(mensaje.createdAt)}</span>
          {propio && <Tildes status={mensaje.status} />}
        </span>
        {fallo && mensaje.error && <span className={styles.chatError}>No se entregó: {mensaje.error}</span>}
      </div>
    </div>
  );
}

/** Los tildes de WhatsApp, con lo único que sabemos de verdad: lo que dijo Twilio. */
function Tildes({ status }: { status: string }) {
  if (status === "failed") return <QosIcon name="alert" size={11} />;
  // 'queued' es un tilde: salió de acá, todavía no hay confirmación del proveedor.
  if (status === "queued") return <QosIcon name="check" size={11} />;
  return (
    <span className={styles.chatTildes}>
      <QosIcon name="check" size={11} />
      <QosIcon name="check" size={11} />
    </span>
  );
}

function Etiqueta({ procedencia }: { procedencia: "equipo" | "externo" }) {
  return (
    <span className={`${styles.chatTag} ${procedencia === "equipo" ? styles.chatTagEquipo : styles.chatTagExterno}`}>
      {procedencia === "equipo" ? "Equipo" : "Externo"}
    </span>
  );
}

function Avatar({ conversacion }: { conversacion: Conversacion }) {
  const iniciales =
    conversacion.procedencia === "equipo"
      ? conversacion.titulo
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : // De un número no hay iniciales que sacar: los dos últimos dígitos
        // alcanzan para distinguir dos hilos en la lista.
        conversacion.telefono?.slice(-2) ?? "?";

  return (
    <span
      className={`${styles.chatAvatar} ${
        conversacion.procedencia === "equipo" ? styles.chatAvatarEquipo : styles.chatAvatarExterno
      }`}
      aria-hidden
    >
      {/* La foto tapa las iniciales, no las reemplaza en el markup: el degradado
          de fondo sigue debajo y se ve mientras la imagen carga. */}
      {conversacion.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={conversacion.avatarUrl} alt="" className={styles.avImg} />
      ) : (
        iniciales || "?"
      )}
    </span>
  );
}

/** "hoy" / "ayer" / "3 ago" para los separadores del hilo. */
function etiquetaDeDia(dia: string): string {
  const hoy = diaCR(new Date());
  if (dia === hoy) return "hoy";
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (dia === diaCR(ayer)) return "ayer";
  return diaCorto(dia);
}

/** La columna derecha de la lista: hora si es de hoy, día si es más viejo. */
function fechaCorta(iso: string): string {
  return diaCR(iso) === diaCR(new Date()) ? horaCR(iso) ?? "" : diaCorto(iso);
}
