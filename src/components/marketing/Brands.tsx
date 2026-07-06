const BRANDS = ["Dulce Chilena", "Entrecote", "Zonna Gastrobar", "Snowty", "La Bonta"];

export default function Brands() {
  const items = [...BRANDS, ...BRANDS];

  return (
    <section className="brands-section">
      <div className="container">
        <p className="brands-title fade-up">Confiado por marcas líderes en su sector</p>
      </div>
      <div className="marquee-container fade-up">
        <div className="marquee-content">
          {items.map((brand, i) => (
            <span className="marquee-item" key={`a-${i}`}>
              {brand}
            </span>
          ))}
        </div>
        <div className="marquee-content" aria-hidden="true">
          {items.map((brand, i) => (
            <span className="marquee-item" key={`b-${i}`}>
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
