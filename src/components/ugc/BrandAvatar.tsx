// Logo de la marca con respaldo a iniciales sobre un degradado estable.
//
// Va con estilos inline a propósito: se usa tanto en los dashboards Q·OS
// (CSS Modules) como en las vistas públicas (Tailwind), y un componente
// compartido no debería depender de ninguno de los dos sistemas. Mismo criterio
// que MediaLightbox.

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// Degradado derivado del nombre: la misma marca siempre se ve igual, y dos
// marcas distintas no se confunden entre sí cuando ninguna subió logo.
const GRADIENTS = [
  ["#705CF6", "#5641D8"],
  ["#8E80F2", "#705CF6"],
  ["#FF6B57", "#D8412B"],
  ["#17A673", "#0E7A53"],
  ["#F2A03D", "#D97706"],
];

function gradientFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const [from, to] = GRADIENTS[hash % GRADIENTS.length];
  return `linear-gradient(150deg, ${from}, ${to})`;
}

export default function BrandAvatar({
  name,
  logoUrl,
  size = 40,
  radius = 12,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  radius?: number;
}) {
  const label = name || "Marca";
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        background: logoUrl ? "#fff" : gradientFor(label),
        color: "#fff",
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          style={{
            // Absoluto por el mismo motivo que .avImg en qos.module.css: el
            // contenedor es un grid con place-items:center, así que un alto
            // porcentual se mediría contra una fila que depende de la imagen.
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        initialsOf(label)
      )}
    </div>
  );
}
