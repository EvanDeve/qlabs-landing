import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cargarLoyaltyMarca } from "@/lib/ugc/loyalty-panel";
import { CuponDetalle } from "@/components/ugc/marca/LoyaltyMarca";
import LoyaltyAtras from "@/components/ugc/marca/LoyaltyAtras";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function CuponMarcaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Trae los cupones de ESTA marca: un id de otro negocio simplemente no está.
  const { cupones, niveles } = await cargarLoyaltyMarca(supabase, user!.id, { conImagenQr: true });
  const cupon = cupones.find((c) => c.id === id);
  if (!cupon) notFound();

  return (
    <div className={styles.mcCol}>
      <LoyaltyAtras />
      <CuponDetalle c={cupon} niveles={niveles} />
    </div>
  );
}
