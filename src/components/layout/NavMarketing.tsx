"use client";

import { useState } from "react";
import Link from "next/link";

export default function NavMarketing() {
  const [open, setOpen] = useState(false);

  return (
    <nav>
      <div className="container nav-wrap">
        <a href="#" className="logo">
          <img src="/favicon-logo.png" alt="Q" style={{ height: "1.4em" }} />
          Q Labs
        </a>

        <ul className={`nav-links${open ? " active" : ""}`}>
          <li>
            <Link href="/ugc" onClick={() => setOpen(false)}>
              UGC·CRC
            </Link>
          </li>
          <li className="mobile-only">
            <a
              href="https://calendly.com/puravidarepublic/aas-pov"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              onClick={() => setOpen(false)}
            >
              Agendar reunión
            </a>
          </li>
        </ul>

        <a
          href="https://calendly.com/puravidarepublic/aas-pov"
          target="_blank"
          rel="noopener noreferrer"
          id="desktop-btn"
          className="btn-primary"
        >
          Agendar reunión
        </a>

        <button
          className="nav-toggle"
          aria-label="Abrir menú"
          onClick={() => setOpen((v) => !v)}
        >
          <i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"}`} />
        </button>
      </div>
    </nav>
  );
}
