/**
 * Muestra un dato registral de la empresa, o un hueco bien visible si todavía
 * no se ha cargado.
 *
 * La alternativa —dejar el texto sin el dato, o poner algo verosímil de
 * relleno— es peor: un documento legal con una razón social inventada es un
 * problema mayor que uno con un campo obviamente pendiente. En coral y entre
 * corchetes se ve a primera vista en una revisión rápida.
 */
export default function Dato({ valor, campo }: { valor: string | null; campo: string }) {
  if (valor) return <>{valor}</>;
  return (
    <span className="font-bold text-coral" title="Falta completar este dato antes de publicar">
      [completar: {campo}]
    </span>
  );
}
