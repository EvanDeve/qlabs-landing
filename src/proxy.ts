import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Q·OS vive fuera de /ugc desde que el panel del equipo dejó de colgar del
  // marketplace, así que el matcher tiene que nombrar los dos árboles.
  matcher: ["/ugc/:path*", "/admin/:path*"],
};
