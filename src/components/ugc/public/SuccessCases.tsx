const CASES = [
  {
    brand: "Zonna",
    industry: "Gastrobar, Escazú",
    quote:
      "Publicamos la campaña de brunch y en menos de una semana ya teníamos creadoras aplicando con propuestas claras.",
  },
  {
    brand: "Kosta Asiatika",
    industry: "Restaurante asiático",
    quote:
      "El unboxing del nuevo menú de ramen nos llegó con reacciones genuinas, justo lo que buscábamos para redes.",
  },
  {
    brand: "Entrecot",
    industry: "Fine dining",
    quote:
      "Nos gustó poder ver el perfil de cada creador antes de aceptar — se siente más humano que otras plataformas.",
  },
];

export default function SuccessCases() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-ink">
          Marcas que ya confían en UGC·CRC
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {CASES.map((item) => (
            <div key={item.brand} className="rounded-card border border-line p-6">
              <p className="text-ink-soft">&ldquo;{item.quote}&rdquo;</p>
              <div className="mt-5">
                <div className="font-extrabold text-ink">{item.brand}</div>
                <div className="text-sm text-ink-soft">{item.industry}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
