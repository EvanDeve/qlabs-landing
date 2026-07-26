"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Reemplaza al fade-up único que se aplicaba a todo por igual. Hay dos maneras
// de reaccionar al scroll y acá se usan las dos a propósito:
//
//   DISPARADA  la animación arranca cuando la sección entra y se reproduce
//              sola. Sirve para entradas: no querés que un titular se
//              desarme si el visitante scrollea para atrás.
//   ATADA      (scrub) la animación avanza y retrocede pegada a la posición
//              del scroll. Es lo que hace que la página se sienta "viva bajo
//              el dedo": parallax, progreso, escalas.
//
// Todo respeta prefers-reduced-motion: si el sistema pide menos movimiento,
// no se anima nada y el contenido queda visible tal cual.

const SEL = ".qlabs-marketing";

export default function ScrollMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sinMovimiento) {
      gsap.set(`${SEL} .fade-up`, { opacity: 1, y: 0, clearProps: "all" });
      const barra = document.querySelector<HTMLElement>(".scroll-progress");
      if (barra) barra.style.display = "none";
      return;
    }

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // ---------------------------------------------------------------
      // Barra de progreso — ATADA. Es la señal más directa de "esta página
      // responde a tu scroll", y cuesta casi nada.
      // ---------------------------------------------------------------
      gsap.to(".scroll-progress-bar", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
      });

      // ---------------------------------------------------------------
      // Entradas genéricas — DISPARADAS. Los .fade-up que no pertenecen a
      // una sección con animación propia siguen funcionando, pero ahora
      // escalonados entre hermanos en vez de todos a la vez.
      // ---------------------------------------------------------------
      gsap.utils.toArray<HTMLElement>(`${SEL} .fade-up`).forEach((el) => {
        if (el.closest("[data-motion]")) return; // lo maneja su sección
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: "top 88%" },
          y: 32,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
          clearProps: "all",
        });
      });

      // ---------------------------------------------------------------
      // HERO — ATADA. Al bajar, el contenido se va más lento que la página
      // y se desvanece: da sensación de profundidad sin mover nada de sitio.
      // Solo en pantallas grandes; en móvil el parallax pelea con el scroll
      // por inercia del navegador y se siente pegajoso.
      // ---------------------------------------------------------------
      // Se anima el CONTENEDOR, no cada hijo: los hijos tienen su propia
      // entrada .fade-up y dos animaciones sobre el mismo `y`/`opacity` se
      // pelean. Padre e hijo componen transforms sin conflicto.
      mm.add("(min-width: 769px)", () => {
        gsap.to(`${SEL} .hero .container`, {
          y: -70,
          opacity: 0.3,
          ease: "none",
          scrollTrigger: {
            trigger: `${SEL} .hero`,
            start: "top top",
            end: "bottom 35%",
            scrub: 0.5,
          },
        });
      });

      // El mockup de video crece un poco al entrar: parece que se acerca.
      gsap.fromTo(
        `${SEL} .hero .video-mockup`,
        { scale: 0.94, y: 40 },
        {
          scale: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: `${SEL} .hero .video-mockup`,
            start: "top 92%",
            end: "top 45%",
            scrub: 0.4,
          },
        }
      );

      // ---------------------------------------------------------------
      // MARCAS — DISPARADA, escalonada. Los logos aparecen uno tras otro,
      // que es lo que hace leer "son varios" en vez de "hay un bloque".
      // ---------------------------------------------------------------
      const logos = gsap.utils.toArray<HTMLElement>(`${SEL} .brands-grid > *`);
      if (logos.length) {
        gsap.from(logos, {
          scrollTrigger: { trigger: `${SEL} .brands-grid`, start: "top 85%" },
          y: 24,
          opacity: 0,
          scale: 0.9,
          duration: 0.5,
          stagger: 0.07,
          ease: "back.out(1.6)",
          clearProps: "all",
        });
      }

      // ---------------------------------------------------------------
      // STATS — DISPARADA. Los números suben desde cero. Es el efecto que
      // más se nota de toda la página.
      // ---------------------------------------------------------------
      gsap.utils.toArray<HTMLElement>(`${SEL} [data-count-to]`).forEach((el) => {
        const destino = Number(el.dataset.countTo);
        const sufijo = el.dataset.countSuffix ?? "";
        if (!Number.isFinite(destino)) return;

        const contador = { valor: 0 };
        gsap.to(contador, {
          valor: destino,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          onUpdate: () => {
            el.textContent = `${Math.round(contador.valor)}${sufijo}`;
          },
        });
      });

      // ---------------------------------------------------------------
      // SERVICIOS — DISPARADA, escalonada, con un leve empuje lateral para
      // que no sea otra vez "sube y aparece".
      // ---------------------------------------------------------------
      const tarjetas = gsap.utils.toArray<HTMLElement>(`${SEL} .service-card`);
      if (tarjetas.length) {
        gsap.from(tarjetas, {
          scrollTrigger: { trigger: `${SEL} .service-grid`, start: "top 82%" },
          y: 48,
          opacity: 0,
          scale: 0.96,
          duration: 0.7,
          stagger: 0.12,
          ease: "power3.out",
          clearProps: "all",
        });
      }

      // ---------------------------------------------------------------
      // TESTIMONIO — ATADA. El teléfono se endereza mientras scrolleás,
      // como si lo estuvieras levantando.
      // ---------------------------------------------------------------
      mm.add("(min-width: 769px)", () => {
        gsap.fromTo(
          `${SEL} .vt-phone-frame`,
          { rotateX: 12, y: 60, scale: 0.95 },
          {
            rotateX: 0,
            y: 0,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: `${SEL} .video-testimonial`,
              start: "top 80%",
              end: "center 55%",
              scrub: 0.5,
            },
          }
        );
      });

      // ---------------------------------------------------------------
      // CTA FINAL — DISPARADA. Entra creciendo: cierra la página con peso.
      // ---------------------------------------------------------------
      gsap.from(`${SEL} .cta-box`, {
        scrollTrigger: { trigger: `${SEL} .cta-box`, start: "top 85%" },
        scale: 0.94,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        clearProps: "all",
      });

      // Las imágenes y videos cambian la altura de la página al cargar, y con
      // ella la posición de cada trigger. Sin esto, los disparos quedan
      // corridos en la primera visita (justo cuando más importa).
      const refrescar = () => ScrollTrigger.refresh();
      window.addEventListener("load", refrescar);
      return () => window.removeEventListener("load", refrescar);
    });

    return () => ctx.revert();
  }, []);

  return null;
}
