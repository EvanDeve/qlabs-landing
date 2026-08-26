import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TranscripcionDetalle from "@/components/ugc/creador/TranscripcionDetalle";

export const dynamic = "force-dynamic";

export default async function TranscripcionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El `.eq("creator_id")` es redundante con la RLS y va igual: deja explícito
  // en el código que una transcripción ajena no se abre, sin depender de que
  // nadie afloje la policy.
  const { data: fila } = await supabase
    .from("creator_transcriptions")
    .select("*")
    .eq("id", id)
    .eq("creator_id", user!.id)
    .maybeSingle();

  if (!fila) notFound();

  return <TranscripcionDetalle fila={fila} />;
}
