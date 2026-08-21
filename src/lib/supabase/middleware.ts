import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

// OJO: "/admin" cubre también "/admin/login" por prefijo, así que la puerta
// se excluye a mano — si no, entrar sin sesión rebota a sí misma en bucle.
//
// "/admin/recuperar" va por lo mismo y es peor si se olvida: la persona que
// necesita esa pantalla es, por definición, la que no tiene sesión, así que
// protegerla la manda al login que justamente no puede pasar. Del lado del
// marketplace "/ugc/recuperar" no necesita excepción porque no cuelga de
// ninguno de los prefijos protegidos.
const PUBLIC_PATHS = ["/admin/login", "/admin/recuperar"];

const PROTECTED_PREFIXES = [
  "/ugc/creador",
  "/ugc/marca",
  "/admin",
  "/ugc/onboarding",
  "/ugc/pendiente",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // OJO: tiene que comparar por SEGMENTO, no con startsWith pelado.
  // "/ugc/creadores/vale".startsWith("/ugc/creador") es true, así que el perfil
  // público del creador (y "/ugc/marcas/..." vs "/ugc/marca") quedaba detrás del
  // login: justo las dos páginas pensadas para compartirse por fuera de la app.
  const { pathname } = request.nextUrl;
  const isProtected =
    !PUBLIC_PATHS.includes(pathname) &&
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

  if (isProtected && !user) {
    // Cada árbol rebota a su propia puerta: el equipo no tiene por qué pasar
    // por el login del marketplace (con su paso de "¿sos creador o marca?")
    // para entrar a Q·OS.
    const login = pathname === "/admin" || pathname.startsWith("/admin/") ? "/admin/login" : "/ugc/login";
    const loginUrl = new URL(login, request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
