import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1MB body limit. Portfolio uploads allow up to
    // 25MB (MAX_PORTFOLIO_FILE_BYTES) and campaign deliveries up to 200MB
    // (MAX_DELIVERY_FILE_BYTES) — raised past the larger of the two.
    serverActions: {
      bodySizeLimit: "210mb",
    },
  },

  async redirects() {
    return [
      // Q·OS se mudó de /ugc/admin a /admin. Esto no es cortesía para los
      // bookmarks: McLovin ya mandó por WhatsApp links a /ugc/admin/pipeline/<id>
      // y a /ugc/admin/marketplace, y esos mensajes son texto plano en el
      // teléfono de cada uno — no hay forma de reescribirlos. Sin este redirect
      // dan 404. Las notificaciones de adentro de la app sí quedaron al día
      // solas: `notifications` no guarda la URL, la arma al renderizar.
      { source: "/ugc/admin", destination: "/admin", permanent: true },
      { source: "/ugc/admin/:path*", destination: "/admin/:path*", permanent: true },

      // El cronograma público salió de /ugc por el mismo motivo, y acá el
      // redirect pesa todavía más: el link se le manda al Hero por WhatsApp,
      // no lo tiene nadie de la casa, y es la única ruta del proyecto que
      // funciona sin sesión. Un 404 acá es un cliente que no puede aprobar su
      // mes y que no tiene a quién reclamarle salvo por WhatsApp.
      { source: "/ugc/cronograma/:token", destination: "/cronograma/:token", permanent: true },

      // Definir contraseña salió de /ugc por lo mismo, y acá el link va DENTRO
      // de un correo: invitaciones al equipo y recuperación de contraseña. Un
      // correo viejo en una bandeja no se puede reescribir, igual que un
      // WhatsApp. Además la pantalla nunca fue del marketplace —la usan las dos
      // puertas—, así que el /ugc/ del principio le decía a alguien del equipo
      // que le habían mandado el link equivocado justo antes de escribir su
      // contraseña.
      //
      // El token viaja en el fragmento (#access_token=...), que el navegador
      // conserva a través del redirect porque el Location no trae uno propio.
      // Por eso un link ya mandado sigue funcionando.
      { source: "/ugc/auth/set-password", destination: "/auth/set-password", permanent: true },
    ];
  },
};

export default nextConfig;
