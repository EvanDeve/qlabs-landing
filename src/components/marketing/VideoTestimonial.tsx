"use client";

import { useRef, useState } from "react";

export default function VideoTestimonial() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    videoRef.current?.play();
    setPlaying(true);
  };

  const pause = () => {
    videoRef.current?.pause();
    setPlaying(false);
  };

  return (
    <section id="testimonial" className="video-testimonial">
      <div className="container">
        <div className="vt-header fade-up">
          <div className="vt-badge">
            <i className="fa-solid fa-circle-play" /> Testimonios reales
          </div>
          <h2>
            Lo que dicen quienes ya <span className="serif-italic">confiaron</span> en
            nosotros
          </h2>
          <p>Cuatro negocios. Cuatro historias de crecimiento real con Q Labs.</p>
        </div>

        <div className="vt-phone-wrap fade-up">
          <div className="vt-phone-glow" />
          <div className="vt-phone-frame">
            <div className="vt-phone-notch" />
            <div className={`vt-phone-screen${playing ? " playing" : ""}`}>
              <video
                ref={videoRef}
                src="/testimonios_compressed.mp4"
                preload="metadata"
                playsInline
                onClick={() => (playing ? pause() : undefined)}
                onEnded={pause}
              />
              <div className="vt-overlay" />
              <button
                className="vt-play-btn"
                aria-label="Reproducir testimonios"
                onClick={play}
              >
                <i className="fa-solid fa-play" />
              </button>
              <div className="vt-phone-label">
                <div className="vt-stars">
                  <i className="fa-solid fa-star" />
                  <i className="fa-solid fa-star" />
                  <i className="fa-solid fa-star" />
                  <i className="fa-solid fa-star" />
                  <i className="fa-solid fa-star" />
                </div>
                <h4>Nuestros clientes</h4>
                <p>Restaurantes &amp; Hoteles</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
