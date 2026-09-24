/**
 * El nombre del programa para clientes de los negocios, en UN solo lugar.
 *
 * Es provisional (2026-09-24): Evan todavía no lo decidió. En código el rol se
 * llama `member` y no cambia; lo que se ve en pantalla sale de acá. Para
 * renombrarlo alcanza con tocar este archivo.
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
