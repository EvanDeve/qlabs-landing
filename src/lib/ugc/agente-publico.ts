import { pedirleAGemini, type TurnoPrevio } from "@/lib/ugc/agente";

/**
 * McLovin contestándole a alguien que NO es del equipo.
 *
 * Es un agente distinto del interno y comparte con él lo mínimo: ni ve la
 * agenda de nadie, ni tiene acciones, ni puede tocar el tablero. Solo habla.
 *
 * La diferencia de fondo con el interno es de honestidad. Adentro, el pedido
 * explícito fue que no se sienta un bot, y funciona porque todos saben que del
 * otro lado hay un sistema. Con alguien de afuera esa misma actuación deja de
 * ser estilo y pasa a ser engaño: la persona no tiene forma de saberlo. Por eso
 * acá McLovin es cordial pero no finge ser un empleado, y si le preguntan, lo
 * dice sin vueltas.
 */

/**
 * Lo que no se edita desde el panel.
 *
 * Un agente que le habla a un potencial cliente puede hacer un daño que el
 * interno no: prometer un precio, inventar un plazo, comprometer al equipo a
 * algo. Nada de eso se arregla después con un "perdón, fue la IA".
 */
const REGLAS_PUBLICAS = `
LO QUE SOS
- Un asistente automático que contesta el WhatsApp de Q Labs.
- Si te preguntan si sos una persona o un bot, decilo de una: sos un asistente
  automático y hay gente del equipo detrás que va a leer la conversación.

CÓMO ESCRIBÍS
- Español de Costa Rica, voseo. Cordial y breve, sin solemnidad.
- Sin viñetas, sin negritas, sin emojis decorativos. Dos o tres líneas alcanzan.

LO QUE NUNCA HACÉS
- Inventar precios, plazos, promociones, casos de éxito ni servicios que no
  estén escritos abajo. Si no está, no existe.
- Prometer que alguien va a llamar, ni a una hora ni en un plazo. Podés decir
  que le pasás el mensaje al equipo, porque eso sí es cierto.
- Pedir datos de tarjeta, contraseñas ni nada por el estilo.
- Cerrar un trato ni dar por confirmado nada. No vendés: orientás y tomás el
  mensaje.

SI TE PREGUNTAN ALGO QUE NO SABÉS
Decí que no lo tenés y que se lo pasás al equipo. Preguntale el nombre y de qué
negocio es, así quien le escriba después ya llega con contexto.
`.trim();

/**
 * Texto de arranque para el panel.
 *
 * NO es un default que se aplique solo: si el campo `sobre_qlabs` está vacío el
 * agente no contesta, aunque el interruptor esté prendido. Esto es únicamente lo
 * que el botón "Usar un texto de arranque" pega en el formulario para que
 * alguien lo edite y decida. Sale de lo que dice la landing hoy.
 */
export const SOBRE_QLABS_ARRANQUE = `
Q Labs es una agencia digital de Costa Rica que trabaja con restaurantes y
hoteles. La idea es simple: el negocio es el que hace el trabajo, nosotros le
damos las herramientas para digitalizarlo y vender más.

Tres cosas hacemos:
Automatización con IA — reservas y mensajes atendidos las 24 horas sin que el
dueño ni su equipo tengan que estar encima.
Contenido y redes — que la presencia digital se vea tan bien como el servicio,
para atraer clientes de más calidad.
Web y ventas en línea — menú, reservas y pagos, para operar más ordenado.

También tenemos UGC·CRC, un marketplace donde negocios costarricenses contratan
creadores de contenido verificados. Está en qlabsmethod.com/ugc.
`.trim();

/** Tope de mensajes por número y por día. Ver hablaDemasiado(). */
export const MAX_MENSAJES_DIA = 20;

/**
 * Lo que se le contesta a alguien de afuera.
 *
 * Devuelve null cuando no hay nada que decir —sin `sobreQlabs` no se contesta,
 * porque un agente sin información improvisa— y un texto de respaldo cuando
 * Gemini no responde. Ese respaldo no es opcional: la persona escribió y está
 * esperando, y quedarse callado es peor que un "ahorita te contestamos".
 */
export async function responderPublico(opciones: {
  nombre: string;
  sobreQlabs: string;
  historial: TurnoPrevio[];
  mensaje: string;
}): Promise<string | null> {
  const { nombre, sobreQlabs, historial, mensaje } = opciones;
  if (!sobreQlabs.trim()) return null;

  const conversacion = historial
    .map((t) => `${t.quien === "agente" ? "VOS" : "PERSONA"}: ${t.texto}`)
    .join("\n");

  const texto = await pedirleAGemini(
    `Te llamás ${nombre} y contestás el WhatsApp de Q Labs.

${REGLAS_PUBLICAS}

ESTO ES TODO LO QUE SABÉS DE Q LABS. No hay nada más:
${sobreQlabs.trim()}

${conversacion ? `LO QUE SE DIJERON ANTES:\n${conversacion}\n\n` : ""}MENSAJE NUEVO: ${mensaje}

Contestale. Devolvé SOLO el mensaje, sin comillas ni explicación.`,
    false
  );

  if (!texto) {
    return "Perdón, ahorita no te puedo contestar bien. Ya le queda el mensaje al equipo y te escriben.";
  }
  return texto.replace(/^["“]([\s\S]*)["”]$/, "$1").trim();
}

/**
 * ¿Este número ya escribió demasiado hoy?
 *
 * Del otro lado no hay una cuenta ni un opt-in: cualquiera con el número puede
 * escribir todas las veces que quiera, y cada mensaje cuesta un llamado a Gemini
 * y uno a Twilio. El tope corta el caso tonto (alguien probando el bot un rato)
 * sin necesitar bloqueos por número.
 */
export function hablaDemasiado(mensajesHoy: number): boolean {
  return mensajesHoy > MAX_MENSAJES_DIA;
}
