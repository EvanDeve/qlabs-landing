import { requireDirector } from "@/lib/auth/require-director";
import { getConversaciones } from "@/lib/ugc/conversaciones";
import { getAjustesAgente } from "@/lib/ugc/agente";
import ChatView from "@/components/ugc/admin/ChatView";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  // Conversaciones enteras de gente real, del equipo y de afuera. Es lo más
  // sensible del panel: solo directores, acá y en la RLS.
  const { supabase } = await requireDirector();

  const [conversaciones, ajustes] = await Promise.all([
    getConversaciones(supabase),
    getAjustesAgente(supabase),
  ]);

  return <ChatView conversaciones={conversaciones} nombreAgente={ajustes.nombre} />;
}
