import { createClient } from "@/lib/supabase/server";
import { cargarLoyaltyMarca } from "@/lib/ugc/loyalty-panel";
import { TablaCanjes, Validador } from "@/components/ugc/marca/LoyaltyMarca";
import LoyaltyAtras from "@/components/ugc/marca/LoyaltyAtras";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function CanjesMarcaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { canjes, nombreMarca } = await cargarLoyaltyMarca(supabase, user!.id);

  return (
    <div className={styles.mcCol}>
      <LoyaltyAtras />
      <h1 className={styles.lmSubTit}>Canjes</h1>
      <TablaCanjes canjes={canjes} />
      {/* El buscador manual vive con los canjes: es la salida para cuando la
          cámara no sirve, y es adonde manda "Buscar el código a mano" de la
          pantalla del escáner (`#buscar`). */}
      <Validador nombreMarca={nombreMarca} />
    </div>
  );
}
