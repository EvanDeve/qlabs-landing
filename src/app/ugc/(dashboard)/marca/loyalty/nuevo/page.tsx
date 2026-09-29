import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CuponForm from "@/components/ugc/marca/CuponForm";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/** Nuevo cupón (mockups 4b y 4c): una pantalla propia con el botón fijo abajo. */
export default async function NuevoCuponPage() {
  const supabase = await createClient();
  const { data: niveles } = await supabase.from("level_thresholds").select("level, name").order("min_points");

  return (
    <div className={styles.mcCol}>
      {/* "Cancelar" y no "‹ Loyalty": esto es un formulario, y el gesto que
          importa es abandonar sin publicar. */}
      <div className={styles.mcFormBar}>
        <Link href="/ugc/marca/loyalty" className={styles.mcCancelar}>
          Cancelar
        </Link>
        <span className={styles.mcFormTitulo}>Nuevo cupón</span>
        <span />
      </div>
      <CuponForm niveles={niveles ?? []} />
    </div>
  );
}
