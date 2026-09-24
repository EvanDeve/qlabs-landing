import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * El freno de las pantallas públicas de Close Friends (registro y entrar).
 *
 * Cuenta en la base (`frenar_registro`, ventana fija) y no en memoria: Vercel
 * reparte los requests entre instancias que nacen y mueren solas.
 *
 * La IP se guarda como HMAC y no en claro. Un sha256 pelado de una IPv4 se
 * revierte probando las 4 mil millones; con la llave de servicio como secreto,
 * no. Lo único que hace falta es poder contar dos pedidos de la misma IP.
 */

/** Los topes, en un solo lugar. Por hora. */
export const TOPES = {
  // Holgado a propósito: en un restaurante media sala comparte el wifi del
  // local, y todos salen con la misma IP.
  porIp: 30,
  // Un QR de caja en un día fuerte. Si se pasa, la marca lo ve y crea otro.
  porCodigo: 120,
  // Entrar con código: pedidos de código por correo desde una IP.
  entrarPorIp: 20,
} as const;

const HORA = 60 * 60;

async function ipHasheada(): Promise<string> {
  const h = await headers();
  // En Vercel la primera de x-forwarded-for es la del cliente; x-real-ip es el
  // respaldo. Sin ninguna (local), todas cuentan juntas como "sin-ip".
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "sin-ip";
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(ip).digest("hex").slice(0, 32);
}

async function pasa(clave: string, max: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("frenar_registro", {
    p_clave: clave,
    p_max: max,
    p_ventana_segundos: HORA,
  });
  // Si el freno mismo falla, se deja pasar: el daño de trabar un registro
  // legítimo en caja es mayor que el de un intento de más, que igual tiene el
  // tope propio de Supabase Auth por correo.
  if (error) {
    console.error("[freno] no se pudo consultar:", error.message);
    return true;
  }
  return data === true;
}

/** Registro por QR: por IP y por código. Alcanza con que uno diga que no. */
export async function frenoRegistro(codigo: string): Promise<boolean> {
  const ip = await ipHasheada();
  const [porIp, porCodigo] = await Promise.all([
    pasa(`registro:ip:${ip}`, TOPES.porIp),
    pasa(`registro:code:${codigo}`, TOPES.porCodigo),
  ]);
  return porIp && porCodigo;
}

/** Entrar con código a una cuenta existente: por IP. */
export async function frenoEntrar(): Promise<boolean> {
  return pasa(`entrar:ip:${await ipHasheada()}`, TOPES.entrarPorIp);
}
