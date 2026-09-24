import { diaCR } from "@/lib/ugc/calendar";
import { CF } from "@/lib/cf/copy";

/**
 * Validación del formulario de alta de Close Friends.
 *
 * Son las mismas reglas que valida `completar_registro_miembro` en la base, que
 * es la que manda. Se repiten acá por un motivo concreto: el código de 6
 * dígitos se manda ANTES de llamar a esa función, y mandar un correo para
 * después decirle a alguien que es menor de edad o que su alias está tomado es
 * hacerle perder un minuto y gastar un envío. Si alguna vez divergen, gana la
 * base y la persona ve su mensaje.
 */

/** Mismo patrón que el CHECK de `members.agent_name`. */
const AGENTE = /^[A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü._]{3,20}$/;
/** Mismo patrón que el CHECK de `members.phone`. */
const TELEFONO_CR = /^\+506[245678]\d{7}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type DatosRegistro = {
  fullName: string;
  phone: string;
  email: string;
  birthdate: string;
  agentName: string;
  aceptaTerminos: boolean;
  comparteConMarca: boolean;
  whatsapp: boolean;
};

/**
 * "8888 7777", "8888-7777", "+506 8888 7777" o "50688887777" → "+50688887777".
 * Solo números de Costa Rica: el formulario dice +506 y la base lo exige.
 */
export function telefonoCR(entrada: string): string | null {
  const digitos = entrada.replace(/\D/g, "");
  const local = digitos.length === 11 && digitos.startsWith("506") ? digitos.slice(3) : digitos;
  const e164 = `+506${local}`;
  return local.length === 8 && TELEFONO_CR.test(e164) ? e164 : null;
}

/**
 * ¿Cumplió 18 al día de hoy EN COSTA RICA? Se compara como texto
 * 'yyyy-mm-dd', que ordena igual que la fecha, para no pasar por un `Date` que
 * lo corra de día según la zona del servidor (ver la nota de fechas: día ≠
 * instante).
 */
export function esMayorDeEdad(nacimiento: string, hoy: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return false;
  const [anio, mes, dia] = diaCR(hoy).split("-");
  const cumple18 = `${Number(anio) - 18}-${mes}-${dia}`;
  return nacimiento <= cumple18;
}

/** Devuelve el primer problema del formulario, o null si está bien. */
export function problemaDelRegistro(d: DatosRegistro, hoy: Date = new Date()): string | null {
  if (d.fullName.trim().length < 2 || d.fullName.trim().length > 80) return "Poné tu nombre.";
  if (!telefonoCR(d.phone)) return "Revisá tu WhatsApp: tiene que ser un número de Costa Rica de 8 dígitos.";
  if (!EMAIL.test(d.email.trim())) return "Revisá tu correo.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.birthdate)) return "Poné tu fecha de nacimiento.";
  if (d.birthdate < "1900-01-01") return "Revisá tu fecha de nacimiento.";
  if (!esMayorDeEdad(d.birthdate, hoy)) return `${CF.programa} es solo para mayores de 18 años.`;
  if (!AGENTE.test(d.agentName.trim())) {
    return "El nombre de agente va de 3 a 20 caracteres: letras, números, punto o guion bajo.";
  }
  if (!d.aceptaTerminos) return "Para unirte tenés que aceptar los términos y la política de privacidad.";
  return null;
}

/** Lee el formulario tal como lo manda el navegador. */
export function datosDelFormulario(f: FormData): DatosRegistro {
  const texto = (k: string) => String(f.get(k) ?? "");
  return {
    fullName: texto("full_name").trim(),
    phone: texto("phone"),
    email: texto("email").trim().toLowerCase(),
    birthdate: texto("birthdate"),
    agentName: texto("agent_name").trim(),
    aceptaTerminos: f.get("acepta_terminos") === "on",
    comparteConMarca: f.get("comparte_con_marca") === "on",
    whatsapp: f.get("whatsapp") === "on",
  };
}

/** El código de invitación como está guardado: 10 caracteres, mayúsculas. */
export function limpiarCodigoInvitacion(codigo: string): string | null {
  const limpio = decodeURIComponent(codigo).trim().toUpperCase();
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/.test(limpio) ? limpio : null;
}
