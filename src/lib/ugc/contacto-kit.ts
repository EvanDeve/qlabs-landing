/**
 * Contacto directo del media kit: el teléfono del creador lo ven solo las
 * marcas verificadas y el equipo de Q Labs.
 *
 * Esto decide QUÉ mostrar. Quién puede leer el número de verdad lo decide la
 * base (`ver_telefono_creador`): acá un error deja un botón de más, no un
 * teléfono expuesto.
 */

export type ModoContacto =
  | "nada" // el creador no lo muestra (RF-12)
  | "propio" // el creador mirando su kit (RF-11)
  | "ver" // marca verificada o equipo: botón "Ver teléfono" (RF-08)
  | "pedir-sesion" // sin sesión (RF-09)
  | "marca-sin-verificar" // marca con sesión pero sin verificar (RF-09)
  | "solo-marcas"; // otro creador o miembro con sesión (RF-09, sin invitarlo a registrarse)

export function modoContacto(p: {
  tieneTelefono: boolean;
  creadorId: string;
  visitante: { id: string; rol: string | null; marcaVerificada: boolean } | null;
}): ModoContacto {
  const { tieneTelefono, creadorId, visitante } = p;
  if (!tieneTelefono) return "nada";
  if (!visitante) return "pedir-sesion";
  if (visitante.id === creadorId) return "propio";
  if (visitante.rol === "admin") return "ver";
  if (visitante.rol === "brand") return visitante.marcaVerificada ? "ver" : "marca-sin-verificar";
  return "solo-marcas";
}

/** "+50688887777" → { legible: "+506 8888 7777", whatsapp: "https://wa.me/50688887777", llamar: "tel:+50688887777" } */
export function enlacesDeTelefono(e164: string): { legible: string; whatsapp: string; llamar: string } {
  const digitos = e164.replace(/\D/g, "");
  // Solo los ticos tienen un formato conocido; a uno de afuera no se le inventa.
  const tico = /^506(\d{4})(\d{4})$/.exec(digitos);
  return {
    legible: tico ? `+506 ${tico[1]} ${tico[2]}` : e164,
    whatsapp: `https://wa.me/${digitos}`,
    llamar: `tel:+${digitos}`,
  };
}
