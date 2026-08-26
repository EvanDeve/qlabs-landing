/**
 * El guion mejorado, de texto a bloques.
 *
 * El guion se sigue guardando como TEXTO PLANO en `improved_script`, no como
 * JSON. Es a propósito y por dos razones que tiran para el mismo lado:
 *
 *   1. El creador lo edita a mano —eso ya existía y no se sacó, solo se mudó
 *      al menú del detalle—. Un textarea con JSON adentro es intocable.
 *   2. Un JSON mal cerrado por el modelo se pierde entero. Un texto con un
 *      encabezado raro pierde ese encabezado y nada más: `parsearGuion` cae a
 *      `texto` y la pantalla muestra el guion crudo, que sigue siendo útil.
 *
 * Eso último es lo que también salva a los guiones VIEJOS: los que se
 * generaron con el prompt anterior (marcas [M:SS] sueltas y una sección
 * "## Qué cambié y por qué") no parsean a bloques, y se muestran tal cual.
 * No hizo falta migrar ni una fila.
 */

export type BloqueDeGuion = {
  /** GANCHO / CUERPO / CIERRE. Se muestra tal cual, en mayúsculas. */
  fase: string;
  /** "0-3 s". Null si el modelo no lo puso: el bloque igual se dibuja. */
  rango: string | null;
  texto: string;
};

export type GuionParseado = {
  /** "Reel · 30 s". Null si no vino. */
  formato: string | null;
  /** Ya en la forma que se lee: "Tono cercano". */
  tono: string | null;
  bloques: BloqueDeGuion[];
  /** Los bullets de "Tomas que te faltan". Vacío si no hay. */
  tomas: string[];
  /**
   * El guion sin la cabecera ni la sección de tomas. Es lo que se muestra
   * cuando no se pudo partir en bloques, y lo que se copia al portapapeles
   * junto con el resto.
   */
  texto: string;
  /** Si es false, la pantalla dibuja `texto` plano en vez de las tarjetas. */
  estructurado: boolean;
};

const RE_FORMATO = /^FORMATO:\s*(.+)$/im;
const RE_TONO = /^TONO:\s*(.+)$/im;
// El encabezado de fase: [GANCHO 0-3 s]. El rango es opcional porque el modelo
// a veces lo omite en guiones cortos, y perder el bloque entero por eso sería
// peor que dibujarlo sin el tiempo.
const RE_BLOQUE = /^\[([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,20}?)(?:\s+([^\]]+))?\]\s*$/;
const RE_TOMAS = /^TOMAS QUE TE FALTAN\s*:?\s*$/i;

/** "- algo" o "• algo" o "* algo". */
const RE_BULLET = /^\s*[-•*]\s+(.+)$/;

export function parsearGuion(crudo: string | null | undefined): GuionParseado {
  const texto = (crudo ?? "").trim();
  const vacio: GuionParseado = {
    formato: null,
    tono: null,
    bloques: [],
    tomas: [],
    texto,
    estructurado: false,
  };
  if (!texto) return vacio;

  const formato = texto.match(RE_FORMATO)?.[1].trim() || null;
  const tonoCrudo = texto.match(RE_TONO)?.[1].trim() || null;
  // El modelo devuelve "Cercano" y la pantalla dice "Tono cercano": la palabra
  // sola no se entiende fuera de contexto en un chip de 90px. Si el modelo ya
  // escribió "Tono cercano", no se duplica.
  const tono = tonoCrudo
    ? /^tono\b/i.test(tonoCrudo)
      ? tonoCrudo
      : `Tono ${tonoCrudo.charAt(0).toLowerCase()}${tonoCrudo.slice(1)}`
    : null;

  const bloques: BloqueDeGuion[] = [];
  const tomas: string[] = [];
  const sueltas: string[] = [];

  let actual: BloqueDeGuion | null = null;
  let enTomas = false;

  for (const linea of texto.split("\n")) {
    if (RE_TOMAS.test(linea.trim())) {
      enTomas = true;
      actual = null;
      continue;
    }

    if (enTomas) {
      const bullet = linea.match(RE_BULLET);
      if (bullet) {
        tomas.push(bullet[1].trim());
      } else if (linea.trim()) {
        // Una línea sin viñeta después del encabezado cierra la sección: el
        // modelo a veces sigue escribiendo, y meter un párrafo entero como si
        // fuera una toma deja la lista ilegible.
        enTomas = false;
        sueltas.push(linea);
      }
      continue;
    }

    const cabecera = linea.trim().match(RE_BLOQUE);
    if (cabecera) {
      actual = { fase: cabecera[1].trim(), rango: cabecera[2]?.trim() ?? null, texto: "" };
      bloques.push(actual);
      continue;
    }

    if (RE_FORMATO.test(linea) || RE_TONO.test(linea)) continue;

    if (actual) {
      actual.texto = actual.texto ? `${actual.texto}\n${linea}` : linea;
    } else if (linea.trim()) {
      sueltas.push(linea);
    }
  }

  for (const b of bloques) b.texto = b.texto.trim();

  // Un bloque sin texto no se dibuja: es un encabezado que quedó colgando.
  const conTexto = bloques.filter((b) => b.texto);

  if (conTexto.length === 0) {
    return { ...vacio, formato, tono, tomas, texto: sinCabecera(texto) };
  }

  return {
    formato,
    tono,
    bloques: conTexto,
    tomas,
    // Lo que quedó fuera de los bloques se conserva: si el modelo escribió una
    // nota antes del gancho, perderla en silencio sería peor que mostrarla.
    texto: sueltas.join("\n").trim(),
    estructurado: true,
  };
}

/** Saca las líneas FORMATO/TONO del texto plano, que ya se ven como chips. */
function sinCabecera(texto: string): string {
  return texto
    .split("\n")
    .filter((l) => !RE_FORMATO.test(l) && !RE_TONO.test(l))
    .join("\n")
    .trim();
}

/**
 * El guion para el portapapeles y para el archivo que se descarga.
 *
 * Se arma desde el texto CRUDO y no desde los bloques: lo que el creador quiere
 * pegar en sus notas es el guion entero tal como lo tiene, con las tomas
 * incluidas. Reconstruirlo desde el parseo solo agrega formas de perder algo.
 */
export function guionParaCopiar(crudo: string | null | undefined): string {
  return (crudo ?? "").trim();
}

/** Nombre del .txt que se descarga. Sin espacios ni acentos. */
export function nombreDeArchivoDeGuion(titulo: string): string {
  const limpio = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `guion-${limpio || "sin-titulo"}.txt`;
}
