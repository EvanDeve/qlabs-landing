const CALENDLY_URL = "https://calendly.com/puravidarepublic/aas-pov";

export default function BigCta() {
  return (
    <section id="agenda" className="big-cta">
      <div className="container">
        <div className="cta-box fade-up">
          <h2>
            La misión empieza con una <span className="serif-italic">Llamada</span>
          </h2>
          <p>
            Diagnóstico gratuito. Te decimos qué herramientas necesita tu negocio para
            vender más.
          </p>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Agendar reunión
          </a>
        </div>
      </div>
    </section>
  );
}
