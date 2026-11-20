import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

/*
 * Las fuentes se sirven desde el repo (src/app/fuentes), no con next/font/google.
 *
 * El 2026-11-20 los builds de Vercel empezaron a fallar al bajar las fuentes de
 * Google ("next/font/google queries have exactly one entry", Turbopack), con
 * caché y sin caché, aunque en local compilaba. Con los archivos en el repo el
 * build no depende de la red. Son los mismos .woff2 que servía Google, subset
 * latino; las cinco variables van en un solo archivo cada una con su rango de
 * pesos. Para sumar un peso o una familia: bajar el .woff2 latino de
 * fonts.googleapis.com/css2 y agregarlo acá.
 */
const jakarta = localFont({
  variable: "--font-jakarta",
  src: [{ path: "./fuentes/plus-jakarta-sans.woff2", weight: "400 800", style: "normal" }],
});

const spaceMono = localFont({
  variable: "--font-space-mono",
  src: [
    { path: "./fuentes/space-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fuentes/space-mono-700.woff2", weight: "700", style: "normal" },
  ],
});

const playfair = localFont({
  variable: "--font-playfair",
  src: [{ path: "./fuentes/playfair-display-italic.woff2", weight: "600 700", style: "italic" }],
});

// Q·OS (módulo interno /admin) usa su propia identidad visual, distinta del
// resto de la app a pedido del usuario.
const outfit = localFont({
  variable: "--font-outfit",
  src: [{ path: "./fuentes/outfit.woff2", weight: "400 800", style: "normal" }],
});

const inter = localFont({
  variable: "--font-inter",
  src: [{ path: "./fuentes/inter.woff2", weight: "400 700", style: "normal" }],
});

const jetbrainsMono = localFont({
  variable: "--font-jetbrains-mono",
  src: [{ path: "./fuentes/jetbrains-mono.woff2", weight: "400 600", style: "normal" }],
});

export const metadata: Metadata = {
  title: "Q Labs — Equipamos restaurantes y hoteles para digitalizarse y vender más",
  description:
    "Q Labs equipa a tu restaurante u hotel con las herramientas exactas para digitalizarse y vender más, de forma medible y sostenible. Tú diriges la misión; nosotros somos tu Q.",
  icons: {
    icon: "/favicon-logo.png",
    // El favicon es PNG transparente y iOS lo compone sobre NEGRO: el acceso
    // directo salía como un cuadrado negro con la Q adentro. Este archivo es el
    // mismo logo aplanado sobre blanco, a 180 px, que es lo que pide iOS.
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    // El nombre que queda debajo del icono en la pantalla de inicio. Sin esto,
    // iOS usa el <title>, que en este sitio es la frase entera de la landing y
    // sale recortada a "Q Labs — Equipam…".
    title: "Q Labs",
    // Deliberadamente en false: `true` haría que el acceso directo abra en modo
    // standalone (sin barras de Safari), que se ve mejor, pero el login con
    // Google sale a otro contexto y la sesión no siempre vuelve. Es un cambio
    // de una línea cuando se quiera probar.
    capable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${spaceMono.variable} ${playfair.variable} ${outfit.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
