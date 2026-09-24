import type { Metadata, Viewport } from "next";
import { CF } from "@/lib/cf/copy";

export const metadata: Metadata = {
  title: CF.programa,
  description: "Los cupones de los negocios que te invitaron, en tu teléfono.",
  manifest: "/cf/manifest.webmanifest",
  applicationName: CF.programa,
  appleWebApp: { capable: true, title: CF.programa, statusBarStyle: "default" },
  // Safari sigue leyendo la etiqueta vieja además de la estándar.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#F6F4FD",
  // `viewportFit: cover` para que env(safe-area-inset-*) tenga valor en iPhone:
  // la barra de abajo lo usa para no quedar bajo la barra de gestos.
  viewportFit: "cover",
};

/** Todo /cf: mobile-first, fondo lavanda como las pantallas públicas de /ugc. */
export default function CfLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-lavender text-ink">{children}</div>;
}
