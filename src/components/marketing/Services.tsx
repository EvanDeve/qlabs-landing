const CALENDLY_URL = "https://calendly.com/puravidarepublic/aas-pov";

const SERVICES = [
  {
    icon: "fa-robot",
    title: "Automatización con AI",
    body: "Reservas y mensajes resueltos 24/7 sin que tú o tu equipo tengan que intervenir.",
  },
  {
    icon: "fa-mobile-screen",
    title: "Contenido & redes",
    body: "Presencia tan premium como tu servicio para atraer más clientes de calidad.",
  },
  {
    icon: "fa-laptop-code",
    title: "Digitalización",
    body: "Menú, reservas y pagos en línea para operar de manera más eficiente y vender más.",
  },
];

export default function Services() {
  return (
    <section id="services" className="services">
      <div className="container">
        <div className="section-header fade-up">
          <h2>
            El kit, armado a tu <span className="serif-italic">medida</span>
          </h2>
        </div>

        <div className="service-grid">
          {SERVICES.map((service) => (
            <div className="service-card fade-up" key={service.title}>
              <div className="service-icon">
                <i className={`fa-solid ${service.icon}`} />
              </div>
              <h3>{service.title}</h3>
              <p>{service.body}</p>
            </div>
          ))}
        </div>

        <div className="services-btn-container fade-up">
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Agendar diagnóstico
          </a>
        </div>
      </div>
    </section>
  );
}
