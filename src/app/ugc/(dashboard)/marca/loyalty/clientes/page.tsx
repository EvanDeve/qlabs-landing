import { createClient } from "@/lib/supabase/server";
import { cargarLoyaltyMarca } from "@/lib/ugc/loyalty-panel";
import { ListaMiembros } from "@/components/ugc/marca/LoyaltyMarca";
import LoyaltyAtras from "@/components/ugc/marca/LoyaltyAtras";
import { CF } from "@/lib/cf/copy";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function ClientesMarcaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { miembros } = await cargarLoyaltyMarca(supabase, user!.id);

  return (
    <div className={styles.mcCol}>
      <LoyaltyAtras />
      <h1 className={styles.lmSubTit}>{CF.programa}</h1>
      <ListaMiembros miembros={miembros} />
    </div>
  );
}
