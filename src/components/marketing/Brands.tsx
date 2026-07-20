const BRANDS = [
  { name: "Kosta Asiatika", logo: "/kosta_logo.jpeg" },
  { name: "Dulce Chilena", logo: "/dulce_logo.png" },
  { name: "Entrecote", logo: "/entrecote_logo.png" },
  { name: "Zonna Gastrobar", logo: "/zonna_logo.png" },
  { name: "Snowty", logo: "/snowty_logo.jpeg" },
  { name: "La Bonta", logo: "/labonta_logo.png" },
];

function BrandMark({ name, logo }: { name: string; logo: string | null }) {
  if (!logo) {
    return (
      <span className="marquee-item">
        <span className="marquee-item-name">{name}</span>
      </span>
    );
  }
  return (
    <span className="marquee-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={name} />
      <span className="marquee-logo-name">{name}</span>
    </span>
  );
}

export default function Brands() {
  return (
    <section className="brands-section">
      <div className="container">
        <p className="brands-title fade-up">Confiado por marcas líderes en su sector</p>
        <div className="brands-grid fade-up">
          {BRANDS.map((brand) => (
            <BrandMark key={brand.name} {...brand} />
          ))}
        </div>
      </div>
    </section>
  );
}
