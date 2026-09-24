import { LEGAL } from "@/lib/legal";

/**
 * El nombre del programa para clientes de los negocios, en UN solo lugar.
 *
 * Es provisional (2026-09-24): Evan todavía no lo decidió. En código el rol se
 * llama `member` y no cambia; lo que se ve en pantalla sale de acá. Para
 * renombrarlo alcanza con tocar este archivo.
 *
 * Lo que NO sale de acá: cuatro mensajes de error de las funciones de la base
 * (`grep -n "Close Friends" supabase/migrations/20260924*`) y la plantilla del
 * correo del código, que vive en Supabase → Authentication → Emails. Casi
 * nadie los ve —el formulario valida antes—, pero al renombrar hay que
 * tocarlos también.
 *
 * Ojo: "Close Friends · CRC" fue en agosto el nombre del programa de
 * recompensas de CREADORES (docs/QLabs_Rewards_GuiaDeIngreso.pdf). Ese nombre
 * ya no se usa en ninguna pantalla de creador.
 */
export const CF = {
  /** El programa. "Te invitó Zonna a Close Friends". */
  programa: "Close Friends",
  /** Una persona. "Miembro Close Friends desde marzo". */
  miembro: "Miembro Close Friends",
  /** Varias, como título de sección o de lista. */
  miembros: "Miembros Close Friends",
  /** Corto, para etiquetas donde no entra el nombre completo. */
  miembroCorto: "Miembro",
} as const;

/**
 * Lo que queda guardado en `member_consents.text_version` cuando alguien acepta
 * o cambia un permiso. Es la versión de la política de privacidad y de los
 * términos (`LEGAL.version`) que tenía delante: si se cambian los textos, se
 * sube la versión ahí y esto la sigue sola.
 */
export const VERSION_TEXTOS = `legal-${LEGAL.version}`;
