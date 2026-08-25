import { LEGAL } from "@/lib/legal";

/**
 * Muestra un dato registral de la empresa cuando existe.
 *
 * Antes pintaba "[completar: razón social]" en coral. Servía como recordatorio
 * mientras los documentos no estaban a la vista de nadie, pero están live: un
 * hueco en coral dentro de los Términos se lee como un sitio a medio hacer, y
 * eso cuesta más confianza de la que ahorra el recordatorio.
 *
 * Ahora el dato que falta simplemente no se dibuja, y la frase que lo contiene
 * se arma para seguir siendo correcta sin él (ver `SiHay`). Lo que NO se hace
 * es rellenar con algo verosímil: una razón social inventada en un documento
 * legal es un problema mucho mayor que uno que dice menos de lo que podría.
 *
 * En desarrollo sí queda una marca visible, para que el pendiente no se
 * duerma. En producción no aparece nunca.
 */
export default function Dato({ valor, campo }: { valor: string | null; campo: string }) {
  if (valor) return <>{valor}</>;
  if (process.env.NODE_ENV === "development") {
    return (
      <span className="font-bold text-coral" title="Falta este dato registral">
        [falta: {campo}]
      </span>
    );
  }
  return null;
}

/**
 * Envuelve el pedazo de frase que solo tiene sentido si el dato existe —la coma
 * y el "cédula jurídica" incluidos—, para que al faltar no quede una oración
 * con puntuación colgando ("es operado por , cédula jurídica , con domicilio en
 * .").
 */
export function SiHay({ valor, children }: { valor: string | null; children: React.ReactNode }) {
  return valor ? <>{children}</> : null;
}

/**
 * Por dónde escribirle a Q Labs. Con correo legal cargado es un `mailto:`; sin
 * él, la agenda pública —el mismo respaldo que ya usa `/ugc/pendiente`—.
 *
 * No puede quedar vacío como los datos registrales: estos documentos prometen
 * derechos sobre los datos personales, y un documento que promete un derecho
 * sin decir por dónde ejercerlo está peor que incompleto.
 */
export function Contacto() {
  const href = LEGAL.contactoEmail ? `mailto:${LEGAL.contactoEmail}` : LEGAL.calendly;
  const texto = LEGAL.contactoEmail ?? "agendá una llamada con nosotros";
  return (
    <a href={href} target={LEGAL.contactoEmail ? undefined : "_blank"} rel="noreferrer" className="underline">
      {texto}
    </a>
  );
}
