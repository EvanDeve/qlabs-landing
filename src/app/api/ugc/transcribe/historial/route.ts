import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Refresca la lista después de transcribir, sin recargar la página entera.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json([], { status: 401 });

  const { data } = await supabase
    .from("creator_transcriptions")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json(data ?? []);
}
