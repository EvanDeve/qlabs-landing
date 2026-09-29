/**
 * El manifest de un panel de /ugc, para que el acceso directo abra como app.
 *
 * En iPhone ya se abría así sin esto: desde iOS 26 todo acceso directo abre
 * como web app. Android no: sin manifest, Chrome crea un acceso directo que
 * abre una pestaña con la barra del navegador. Lo que Chrome pide para
 * instalar es esto — nombre, `start_url`, `display: standalone` e íconos de
 * 192 y 512 px — servido fuera de lo que protege el middleware, porque el
 * navegador lo pide sin la cookie de sesión y un redirect al login lo rompe.
 *
 * `scope` es /ugc/ entero y no solo el panel: si la sesión vence, el login
 * (/ugc/login) sigue adentro de la app en vez de abrirse con la barra del
 * navegador encima.
 */
export function manifestDePanel(panel: "marca" | "creador") {
  return Response.json(
    {
      id: `/ugc/${panel}`,
      name: panel === "marca" ? "Q Labs para negocios" : "Q Labs para creadores",
      short_name: "Q Labs",
      start_url: `/ugc/${panel}`,
      scope: "/ugc/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#f5f5fa",
      theme_color: "#f5f5fa",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
