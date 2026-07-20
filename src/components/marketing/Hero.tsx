const CALENDLY_URL = "https://calendly.com/puravidarepublic/aas-pov";

export default function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="badge-group fade-up">
          <div className="avatars">
            {/* eslint-disable @next/next/no-img-element */}
            <img src="/kosta_logo.jpeg" alt="Kosta Asiatika" />
            <img src="/entrecote_logo.png" alt="Entrecote" />
            <img src="/zonna_logo.png" alt="Zonna Gastrobar" />
          </div>
          <span className="badge-text">Para restaurantes y hoteles</span>
        </div>

        <h1 className="fade-up">
          Tu hotel o restaurante es el agente. Nosotros somos tu{" "}
          <img
            src="/favicon-logo.png"
            alt="Q"
            style={{
              height: "1.1em",
              verticalAlign: "middle",
              marginBottom: "0.15em",
              display: "inline-block",
            }}
          />
          .
        </h1>
        <p className="fade-up">
          Te damos las herramientas para digitalizar tu negocio y vender más.
          Tú cumples la misión.
        </p>

        <div className="hero-btns fade-up">
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Agendar reunión
          </a>
          <a href="#services" className="btn-outline">
            Ver kit
          </a>
        </div>

        <div className="video-mockup fade-up" style={{ marginTop: 60 }}>
          <video src="/hotels_video.mp4" autoPlay loop muted playsInline />
        </div>
      </div>
    </section>
  );
}
