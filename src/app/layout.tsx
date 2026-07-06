import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Mono, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["italic"],
});

export const metadata: Metadata = {
  title: "Q Labs — Equipamos restaurantes y hoteles para digitalizarse y vender más",
  description:
    "Q Labs equipa a tu restaurante u hotel con las herramientas exactas para digitalizarse y vender más, de forma medible y sostenible. Tú diriges la misión; nosotros somos tu Q.",
  icons: {
    icon: "/favicon-logo.png",
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
      className={`${jakarta.variable} ${spaceMono.variable} ${playfair.variable}`}
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
