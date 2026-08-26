import { NextResponse } from "next/server";
import { accesoDeApi } from "@/lib/auth/acceso-api";

// Refresca la lista después de transcribir, sin recargar la página entera.
export async function GET() {
  const acceso = await accesoDeApi(["creator", "admin"]);
  if (!acceso.ok) return NextResponse.json([], { status: acceso.status });
  const { user, supabase } = acceso;

  const { data } = await supabase
    .from("creator_transcriptions")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json(data ?? []);
}
