/**
 * Datos de la empresa y fechas que usan los documentos legales.
 *
 * Están acá y no sueltos en el JSX para que actualizar la razón social o el
 * correo de contacto sea un solo cambio en un solo archivo, y no una cacería
 * por dos documentos largos.
 *
 * ⚠️ Los valores en `null` NO los puede inventar el código: son datos
 * registrales reales. Mientras estén en `null` los documentos se arman sin
 * ellos, con frases que siguen siendo correctas (ver `Dato` y `SiHay`), y en
 * desarrollo queda una marca visible para que el pendiente no se duerma.
 * Poner algo verosímil de relleno sería peor que decir de menos: una razón
 * social inventada en un documento legal es un problema, un documento que
 * identifica a la empresa por su nombre comercial no lo es.
 */

export const LEGAL = {
  /** Razón social inscrita ante el Registro Nacional. */
  razonSocial: null as string | null,
  /** Cédula jurídica. */
  cedulaJuridica: null as string | null,
  /** Domicilio social. */
  domicilio: null as string | null,
  /** Correo para consultas legales y para ejercer derechos de la Ley 8968. */
  contactoEmail: null as string | null,

  nombreComercial: "Q Labs",
  marketplace: "UGC·CRC",
  sitio: "qlabsmethod.com",

  /**
   * Agenda pública del negocio. Es el canal de contacto de respaldo mientras no
   * haya un correo legal: los documentos prometen derechos (Ley 8968) y tienen
   * que decir por dónde ejercerlos. La misma que usa `/ugc/pendiente`.
   */
  calendly: "https://calendly.com/puravidarepublic/aas-pov",

  /** Fecha de la versión vigente de ambos documentos. */
  vigenciaDesde: "27 de julio de 2026",
  version: "1.0",
} as const;

/** Comisión que retiene la agencia. Espejo de AGENCY_FEE_RATE en ugc/payout.ts. */
export const COMISION_PORCENTAJE = 20;
export const PAGO_CREADOR_PORCENTAJE = 100 - COMISION_PORCENTAJE;
