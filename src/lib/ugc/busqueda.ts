import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { AgendaItem } from "@/lib/ugc/agenda";

/**
 * Buscar una tarjeta en TODO el tablero, no solo en la agenda de quien pregunta.
 *
 * La agenda contesta "qué te toca": lo tuyo, de 30 días atrás a 3 adelante. Es
 * la ventana correcta para un recordatorio y la equivocada para una pregunta —
 * "¿en qué anda el reel de brunch?" no se puede contestar si el reel publica en
 * diez días, y hasta ahora McLovin no podía ni nombrarlo. De 141 tarjetas veía
 * un puñado.
 *
 * Esto le da ojos sobre el resto. No le da manos: escribir sigue pasando por la
 * revalidación de siempre, que exige que la pieza sea de quien la pide.
 *
 * CÓMO BUSCA, y por qué así. El modelo no pide la búsqueda —eso serían dos
 * llamadas y el doble de latencia, que es justo lo que acabamos de arreglar—:
 * se busca ANTES de escribirle, con lo que el mensaje menciona. Tres pescas
 * independientes, unidas y recortadas:
 *
 *   1. Un Hero nombrado          → sus tarjetas
 *   2. Una columna nombrada      → lo que hay parado ahí
 *   3. Palabras sueltas          → títulos que las contengan
 *
 * Se prefiere traer de más y que el modelo elija, antes que afinar la pesca y
 * que la tarjeta que la persona tenía en la cabeza no esté. Lo que no aparece
 * no existe para él, y contestar "no lo veo" sobre algo que sí está es peor que
 * mostrar tres tarjetas de sobra.
 */

/** Cuántas tarjetas de más se le muestran. Ver el comentario de arriba. */
export const TOPE_RESULTADOS = 12;

/** Largo mínimo de una palabra para buscarla en un título. */
const LARGO_MINIMO = 4;

/**
 * Palabras que aparecen en cualquier mensaje y no dicen nada de qué buscar.
 *
 * No es una lista de stopwords del español: es la lista de lo que la gente
 * ESCRIBE ACÁ. "mae", "pura", "vida" y "dale" no están en ningún diccionario de
 * stopwords y son las que más se repiten en este chat.
 */
const VACIAS = new Set([
  "para", "pero", "porque", "como", "cuando", "donde", "esta", "este", "esto", "esos", "esas",
  "tengo", "tenes", "tenés", "tiene", "hay", "anda", "andan", "estan", "están", "queda", "quedan",
  "mae", "pura", "vida", "dale", "gracias", "favor", "puedo", "podes", "podés", "puede", "pueden",
  "hacer", "hice", "listo", "lista", "todo", "toda", "todos", "todas", "algo", "cosa", "cosas",
  "semana", "mes", "dia", "día", "hoy", "mañana", "ayer", "ahora", "luego", "despues", "después",
  "mclovin", "please", "gracias",
]);

export type Busqueda = {
  /** Heroes nombrados en el mensaje. */
  heroIds: string[];
  /** Columnas nombradas en el mensaje. */
  columnaIds: string[];
  /** Palabras con las que buscar en los títulos. */
  palabras: string[];
};

/** Sin tildes, sin mayúsculas, sin espacios de más. Igual que en agente.ts. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Qué buscar, leído del mensaje. Función pura: es lo único de acá que vale la
 * pena testear en serio.
 *
 * Los nombres compuestos se buscan enteros contra el mensaje —"kosta asiatika"
 * aparece tal cual— y no palabra por palabra, que traería todo lo de cualquier
 * Hero con "la" en el nombre.
 */
export function leerBusqueda(
  mensaje: string,
  heroes: { id: string; name: string }[],
  columnas: { id: string; name: string }[]
): Busqueda {
  const texto = normalizar(mensaje);

  const heroIds = heroes.filter((h) => texto.includes(normalizar(h.name))).map((h) => h.id);
  const columnaIds = columnas.filter((c) => texto.includes(normalizar(c.name))).map((c) => c.id);

  // Los nombres ya pescados salen de las palabras sueltas: buscar "zonna" en los
  // títulos después de haber traído todo lo de Zonna es traer lo mismo dos veces.
  const yaPescado = new Set(
    [...heroes.filter((h) => heroIds.includes(h.id)), ...columnas.filter((c) => columnaIds.includes(c.id))]
      .flatMap((x) => normalizar("name" in x ? x.name : "").split(" "))
  );

  const palabras = [
    ...new Set(
      texto
        // Solo letras y números: un "¿" o una coma pegada rompen el ilike.
        .replace(/[^\p{L}\p{N} ]+/gu, " ")
        .split(" ")
        .filter((p) => p.length >= LARGO_MINIMO && !VACIAS.has(p) && !yaPescado.has(p))
    ),
  ];

  return { heroIds, columnaIds, palabras };
}

/** ¿Hay algo con qué buscar? Sin esto se pagarían consultas por cada "dale". */
export function vale(b: Busqueda): boolean {
  return b.heroIds.length > 0 || b.columnaIds.length > 0 || b.palabras.length > 0;
}

/**
 * Un ítem del tablero que NO está en la agenda de quien pregunta.
 *
 * Trae el id del dueño y el nombre por separado: acá adentro solo se sabe el id,
 * y resolver los nombres es una consulta más que solo vale la pena hacer si la
 * búsqueda trajo algo. La llena quien llama.
 */
export type ItemDelTablero = AgendaItem & {
  ownerId: string | null;
  /** El nombre de quien la tiene. La agenda no lo lleva: todo lo suyo es suyo. */
  responsable: string | null;
  /**
   * Es de OTRA persona del equipo.
   *
   * No alcanza con mirar si hay responsable: una tarjeta puede ser tuya y estar
   * acá igual, porque cayó fuera de la ventana de tu agenda. Sin esta
   * distinción, McLovin te contestaba "ya le avisé a Evan" hablándote de vos en
   * tercera persona — y encima mintiendo, porque a uno mismo no se le avisa.
   */
  ajena: boolean;
};

/**
 * Las tarjetas del tablero que calzan con lo que preguntó.
 *
 * `yaEnAgenda` son las keys de lo que ya se le está mostrando: repetir una
 * tarjeta con dos números distintos es cómo el modelo termina moviendo una y
 * diciendo que movió la otra.
 */
export async function buscarEnElTablero(
  supabase: SupabaseClient<Database>,
  busqueda: Busqueda,
  contexto: {
    yaEnAgenda: Set<string>;
    heroePorId: Map<string, string>;
    columnaPorId: Map<string, string>;
    /** Las columnas que cierran cada carril. Lo cerrado se muestra al final. */
    columnasFinales: Set<string>;
    /** Quién está preguntando, para saber qué es suyo y qué es de otro. */
    profileId: string;
  }
): Promise<ItemDelTablero[]> {
  if (!vale(busqueda)) return [];

  const columnas = "id, title, brand_id, owner_id, publish_date, record_date, priority, column_id";
  const consultas = [];

  if (busqueda.heroIds.length) {
    consultas.push(
      supabase.from("content_pieces").select(columnas).in("brand_id", busqueda.heroIds).order("publish_date", { ascending: false, nullsFirst: false }).limit(TOPE_RESULTADOS * 2)
    );
  }
  if (busqueda.columnaIds.length) {
    consultas.push(
      supabase.from("content_pieces").select(columnas).in("column_id", busqueda.columnaIds).order("publish_date", { ascending: false, nullsFirst: false }).limit(TOPE_RESULTADOS * 2)
    );
  }
  if (busqueda.palabras.length) {
    consultas.push(
      supabase
        .from("content_pieces")
        .select(columnas)
        // El `*` es el comodín de PostgREST, no el `%` de SQL. Las palabras ya
        // vienen sin puntuación de leerBusqueda(), que es lo que evita que una
        // coma parta la lista de condiciones en dos.
        .or(busqueda.palabras.map((p) => `title.ilike.*${p}*`).join(","))
        .order("publish_date", { ascending: false, nullsFirst: false })
        .limit(TOPE_RESULTADOS * 2)
    );
  }

  const resultados = await Promise.all(consultas);

  const vistas = new Set<string>();
  const items: (ItemDelTablero & { cerrada: boolean })[] = [];

  for (const { data, error } of resultados) {
    if (error) {
      console.error("[busqueda] no se pudo buscar en el tablero:", error.message);
      continue;
    }
    for (const p of data ?? []) {
      if (vistas.has(p.id)) continue;
      vistas.add(p.id);

      // La misma clave que arma la agenda para su ítem de publicación: es lo que
      // deja detectar que esta tarjeta ya se la estamos mostrando.
      const key = `piece-publish-${p.id}`;
      if (contexto.yaEnAgenda.has(key) || contexto.yaEnAgenda.has(`piece-sinfecha-${p.id}`)) continue;

      items.push({
        cerrada: contexto.columnasFinales.has(p.column_id),
        key: `tablero-${p.id}`,
        ref: { kind: "piece", pieceId: p.id, campo: "publish_date" },
        titulo: p.title,
        heroe: p.brand_id ? contexto.heroePorId.get(p.brand_id) ?? null : null,
        fecha: p.publish_date,
        conHora: false,
        // Sin fecha no hay verbo, igual que en la agenda: es una tarjeta parada
        // en una columna y decir "Publicar" sugeriría un compromiso que nadie tomó.
        accion: p.publish_date ? "Publicar" : null,
        columna: contexto.columnaPorId.get(p.column_id) ?? null,
        prioridad: p.priority,
        // El aviso de riesgo es de la agenda, que es la que mira si algo se
        // viene encima. Acá se está contestando una pregunta, no empujando.
        enRiesgo: false,
        ownerId: p.owner_id,
        responsable: null,
        ajena: p.owner_id !== null && p.owner_id !== contexto.profileId,
      });

    }
  }

  return ordenarPorRelevancia(items).slice(0, TOPE_RESULTADOS);
}

/**
 * Lo que se está haciendo primero; lo ya cerrado al final.
 *
 * Contra el tablero real, "¿en qué anda lo de Zonna?" traía cuatro tarjetas
 * PUBLICADAS del 6 de agosto y el tope se llenaba con eso: lo que la persona
 * estaba preguntando quedaba afuera por orden de llegada. Una tarjeta cerrada
 * sigue siendo una respuesta válida —"eso ya salió"— pero nunca es la primera.
 *
 * Dentro de cada grupo manda la fecha más cercana, y las sin fecha van al final
 * de su grupo: no están atrasadas, solo sin decidir.
 */
function ordenarPorRelevancia(items: (ItemDelTablero & { cerrada: boolean })[]): ItemDelTablero[] {
  return [...items]
    .sort((a, b) => {
      if (a.cerrada !== b.cerrada) return a.cerrada ? 1 : -1;
      if (!a.fecha) return b.fecha ? 1 : a.titulo.localeCompare(b.titulo);
      if (!b.fecha) return -1;
      return a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo);
    })
    .map((item) => {
      // `cerrada` es andamio del ordenamiento: no viaja al prompt, donde la
      // columna ya dice lo mismo y con su nombre.
      const copia: ItemDelTablero & { cerrada?: boolean } = { ...item };
      delete copia.cerrada;
      return copia as ItemDelTablero;
    });
}
