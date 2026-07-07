type StatsProps = {
  campaignsCount: number;
  creatorsCount: number;
  brandsCount: number;
};

export default function Stats({ campaignsCount, creatorsCount, brandsCount }: StatsProps) {
  const stats = [
    { num: `${campaignsCount}`, label: "Campañas activas" },
    { num: `${creatorsCount}`, label: "Creadores verificados" },
    { num: `${brandsCount}`, label: "Marcas en la plataforma" },
  ];

  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-14 sm:grid-cols-3">
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
