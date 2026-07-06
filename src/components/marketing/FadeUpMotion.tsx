"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function FadeUpMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".qlabs-marketing .fade-up").forEach((element) => {
        gsap.from(element, {
          scrollTrigger: { trigger: element, start: "top 85%" },
          y: 40,
          opacity: 0,
          duration: 0.8,
          ease: "power2.out",
          clearProps: "all",
        });
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
