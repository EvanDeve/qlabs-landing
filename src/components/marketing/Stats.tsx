const STATS = [
  { num: "200%", label: "Crecimiento promedio en ventas" },
  { num: "95%", label: "Tasa de retención de clientes" },
  { num: "24/7", label: "Operación de sistemas automatizados" },
];

export default function Stats() {
  return (
    <section className="stats">
      <div className="container">
        <h2 className="stats-title fade-up">
          Tu socio estratégico para <span className="serif-italic">Digitalizar</span> tu
          negocio y vender más
        </h2>
        <div className="stats-grid fade-up">
          {STATS.map((stat) => (
            <div className="stat-item" key={stat.label}>
              <div className="stat-num">{stat.num}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
