import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { limpiarCodigoInvitacion } from "@/lib/cf/registro";
import { qrUnirmePng, qrUnirmeSvg } from "@/lib/cf/qr";

/**
 * Descargar el QR de un cupón: `?formato=png` (para imprimir) o `svg` (para la
 * imprenta o un diseñador, que lo escala sin perder nitidez).
 *
 * El código se lee con la sesión de la marca: la RLS de `brand_invite_codes`
 * solo le devuelve los suyos, así que un código ajeno da 404 igual que uno
 * inventado. El middleware ya exige sesión en /ugc/marca.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = limpiarCodigoInvitacion((await params).codigo);
  if (!codigo) return new NextResponse("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: qr } = await supabase.from("brand_invite_codes").select("code, label").eq("code", codigo).maybeSingle();
  if (!qr) return new NextResponse("No encontrado", { status: 404 });

  const formato = request.nextUrl.searchParams.get("formato") === "svg" ? "svg" : "png";
  // "Torta gratis" → qr-torta-gratis.png. Sin tildes ni símbolos: el nombre va
  // en un header y en el sistema de archivos de quien lo baja.
  const base = qr.label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const nombre = `qr-${base || "cupon"}.${formato}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${nombre}"`,
    "Cache-Control": "private, no-store",
  };

  if (formato === "svg") {
    return new NextResponse(await qrUnirmeSvg(qr.code), {
      headers: { ...headers, "Content-Type": "image/svg+xml" },
    });
  }
  return new NextResponse(new Uint8Array(await qrUnirmePng(qr.code)), {
    headers: { ...headers, "Content-Type": "image/png" },
  });
}
