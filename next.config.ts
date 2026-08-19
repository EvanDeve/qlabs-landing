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
    ];
  },
};

export default nextConfig;
