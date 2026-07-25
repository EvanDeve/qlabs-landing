type StatsProps = {
  campaignsCount: number;
  creatorsCount: number;
  brandsCount: number;
};

export default function Stats({ campaignsCount, creatorsCount, brandsCount }: StatsProps) {
  // Un "0" grande en la home es peor que no mostrar el dato: al arrancar puede
  // no haber todavía creadores verificados o campañas publicadas.
  const stats = [
    { num: campaignsCount, label: "Campañas activas" },
    { num: creatorsCount, label: "Creadores verificados" },
    { num: brandsCount, label: "Marcas en la plataforma" },
  ].filter((s) => s.num > 0);

  if (stats.length === 0) return null;

  // Clases literales a propósito: Tailwind no puede detectar nombres armados
  // dinámicamente, y un style inline pisaría el grid-cols-1 de mobile.
  const cols =
    stats.length === 1 ? "sm:grid-cols-1" : stats.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <section className="border-b border-line">
      <div className={`mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-14 ${cols}`}>
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-4xl font-extrabold text-violet">{stat.num}</div>
            <div className="mt-1 text-sm font-semibold text-ink-soft">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
