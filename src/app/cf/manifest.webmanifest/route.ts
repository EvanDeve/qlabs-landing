import { CF } from "@/lib/cf/copy";

/**
 * La "app" de Close Friends en la pantalla de inicio. Manifest propio y no el
 * del sitio: con `scope` y `start_url` en /cf, iOS abre todo el panel como app
 * —sin el visor de Safari con botón de cerrar— y siempre arranca en el Inicio
 * del miembro, no en la página del QR desde donde lo agregó.
 */
export function GET() {
  return Response.json(
    {
      name: CF.programa,
      short_name: CF.programa,
      description: "Tus cupones de los negocios que te invitaron",
      start_url: "/cf",
      scope: "/cf/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#F6F4FD",
      theme_color: "#F6F4FD",
      icons: [
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
