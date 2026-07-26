// countTo/suffix hacen que el número suba desde cero al entrar en pantalla.
// "24/7" no es una cantidad sino una expresión, así que se deja quieto: verlo
// contar hasta 24 y quedar en "24/7" se leería como un error, no como un dato.
const STATS = [
  { num: "200%", label: "Crecimiento promedio en ventas", countTo: 200, suffix: "%" },
  { num: "95%", label: "Tasa de retención de clientes", countTo: 95, suffix: "%" },
  { num: "24/7", label: "Operación de sistemas automatizados", countTo: null, suffix: "" },
];

export default function Stats() {
  return (
    <section className="stats">
      <div className="container">
        <h2 className="stats-title fade-up">
          Tu socio estratégico para <span className="serif-italic">Digitalizar</span> tu
          negocio y vender más
        </h2>
        <div className="stats-grid" data-motion="stats">
          {STATS.map((stat) => (
            <div className="stat-item" key={stat.label}>
              {/* El valor final va en el HTML: si JS no corre o el visitante
                  pidió menos movimiento, el dato se ve igual. */}
              <div
                className="stat-num"
                {...(stat.countTo !== null
                  ? { "data-count-to": stat.countTo, "data-count-suffix": stat.suffix }
                  : {})}
              >
                {stat.num}
              </div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
