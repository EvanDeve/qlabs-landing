import type { PasoVerificacion } from "@/components/ugc/ChecklistVerificacion";

/**
 * Qué le falta a un negocio para que la verificación sea fácil de aprobar.
 *
 * Vive acá y no en cada pantalla porque el aviso de "en revisión" sale en dos
 * lugares (el perfil y el panel de UGC·CRC): con la lista duplicada, tocar un
 * paso en uno y olvidarse del otro deja al mismo negocio con dos listas que
 * no coinciden.
 *
 * Son señales de "perfil completo", NO los criterios de aprobación — esos los
 * define el equipo y todavía no están escritos (pendiente del proceso de
 * verificación). Por eso ninguno promete que al completarlos te aprueben.
 */
export function pasosVerificacionMarca(
  brand: {
    industry?: string | null;
    description?: string | null;
    location?: string | null;
    logo_url?: string | null;
  } | null,
  campaignCount: number
): PasoVerificacion[] {
  return [
    // El nombre NO es un paso: es obligatorio para registrarse, así que
    // siempre está y solo servía para que la lista arrancara en 0/5 con algo
    // que ya se había hecho. Un check que nunca puede faltar no informa.
    {
      texto: "Decí a qué se dedica tu negocio",
      hecho: Boolean(brand?.industry?.trim()),
      href: "/ugc/marca/perfil",
    },
    {
      texto: "Subí tu logo",
      hecho: Boolean(brand?.logo_url),
      href: "/ugc/marca/perfil",
    },
    {
      texto: "Zona donde se graba",
      hecho: Boolean(brand?.location?.trim()),
      href: "/ugc/marca/perfil",
    },
    {
      texto: "Contá qué hace tu negocio",
      hecho: Boolean(brand?.description?.trim()),
      href: "/ugc/marca/perfil",
    },
    {
      texto: "Dejá tu primera campaña como borrador",
      hecho: campaignCount > 0,
      href: "/ugc/marca/campanas/nueva",
    },
  ];
}

/** El equivalente del creador. Mismo criterio: señales, no requisitos. */
export function pasosVerificacionCreador(
  creator: {
    handle?: string | null;
    instagram_handle?: string | null;
    tiktok_handle?: string | null;
  } | null,
  profile: { bio?: string | null; city?: string | null; avatar_url?: string | null } | null,
  bookCount: number
): PasoVerificacion[] {
  return [
    {
      texto: "Subí tu foto de perfil",
      hecho: Boolean(profile?.avatar_url),
      href: "/ugc/creador/perfil",
    },
    {
      texto: "Escribí tu bio y tu ciudad",
      hecho: Boolean(profile?.bio?.trim() && profile?.city?.trim()),
      href: "/ugc/creador/perfil",
    },
    {
      texto: "Conectá al menos una red",
      hecho: Boolean(creator?.instagram_handle?.trim() || creator?.tiktok_handle?.trim()),
      href: "/ugc/creador/perfil",
    },
    {
      texto: "Subí al menos una pieza a tu book",
      hecho: bookCount > 0,
      href: "/ugc/creador/book",
    },
  ];
}
