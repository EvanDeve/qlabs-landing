import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cargarLoyaltyMarca } from "@/lib/ugc/loyalty-panel";
import { ESTADO_CUPON } from "@/lib/ugc/loyalty";
import LoyaltyAtras from "@/components/ugc/marca/LoyaltyAtras";
import QrCupon from "@/components/ugc/marca/QrCupon";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { CF } from "@/lib/cf/copy";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * Todos los QR del negocio en un lugar. Siguen siendo uno POR CUPÓN (decisión
 * del 2026-09-24): no hay un QR "del local" que una sin regalar nada. Esta
 * pantalla solo los junta para imprimirlos o apagarlos sin entrar a cada cupón.
 */
export default async function QrMarcaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { cupones } = await cargarLoyaltyMarca(supabase, user!.id, { conImagenQr: true });
  const conQr = cupones.filter((c) => c.qr);

  return (
    <div className={styles.mcCol}>
      <LoyaltyAtras />
      <h1 className={styles.lmSubTit}>QR del local</h1>
      <p className={styles.lmSubBajada}>
        Cada cupón para clientes tiene su QR. Quien lo escanea se une a {CF.programa} y se lleva el cupón.
      </p>

      {conQr.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>
          Todavía no tenés cupones para clientes. Creá uno con &quot;Para quién es: Clientes&quot; y acá aparece su
          QR.
        </div>
      ) : (
        conQr.map((c) => (
          <div key={c.id} className={styles.mcCard}>
            <Link href={`/ugc/marca/loyalty/cupon/${c.id}`} className={styles.mcCardTop} style={{ color: "inherit" }}>
              <div style={{ minWidth: 0 }}>
                <div className={styles.mcCardTitulo}>{c.title}</div>
                <div className={styles.mcCardMeta}>
                  {ESTADO_CUPON[c.status] ?? c.status} · {c.stockAvailable} de {c.stockTotal} disponibles
                </div>
              </div>
              <QosIcon name="chevR" size={16} className={styles.lmChev} />
            </Link>
            <QrCupon qr={c.qr!} />
          </div>
        ))
      )}
    </div>
  );
}
