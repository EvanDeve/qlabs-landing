"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Mismo criterio que el ScrollMotion de la landing de marketing, pero para
// /ugc: DISPARADAS las entradas, ATADA (scrub) la barra de progreso.
//
// Acá los selectores van por data-anim y no por clase: /ugc es Tailwind, y
// enganchar animaciones a clases utilitarias significa que cualquier ajuste
// visual futuro rompe el movimiento en silencio.

export default function UgcScrollMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sinMovimiento) {
      const barra = document.querySelector<HTMLElement>(".ugc-progress");
      if (barra) barra.style.display = "none";
      return;
    }

    const ctx = gsap.context(() => {
      // Progreso de lectura, atado al scroll.
      gsap.to(".ugc-progress-bar", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
      });

      // HERO — entra al cargar, escalonado. Es lo primero que se ve, así que
      // no espera al scroll.
      const hero = gsap.utils.toArray<HTMLElement>('[data-anim="hero"] > *');
      if (hero.length) {
        gsap.from(hero, {
          y: 28,
          opacity: 0,
          duration: 0.7,
          stagger: 0.09,
          ease: "power3.out",
          clearProps: "all",
        });
      }

      // Bloques que entran al aparecer en pantalla.
      gsap.utils.toArray<HTMLElement>("[data-anim-in]").forEach((el) => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: "top 88%" },
          y: 32,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
          clearProps: "all",
        });
      });

      // Listas escalonadas (preguntas frecuentes).
      gsap.utils.toArray<HTMLElement>("[data-anim-stagger]").forEach((lista) => {
        const hijos = Array.from(lista.children) as HTMLElement[];
        if (!hijos.length) return;
        gsap.from(hijos, {
          scrollTrigger: { trigger: lista, start: "top 85%" },
          y: 24,
          opacity: 0,
          duration: 0.5,
          stagger: 0.08,
          ease: "power2.out",
          clearProps: "all",
        });
      });

      // CTA final — entra creciendo, para cerrar con peso.
      const cta = document.querySelector('[data-anim="cta"]');
      if (cta) {
        gsap.from(cta, {
          scrollTrigger: { trigger: cta, start: "top 85%" },
          scale: 0.95,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          clearProps: "all",
        });
      }

      const refrescar = () => ScrollTrigger.refresh();
      window.addEventListener("load", refrescar);
      return () => window.removeEventListener("load", refrescar);
    });

    return () => ctx.revert();
  }, []);

  return null;
}
