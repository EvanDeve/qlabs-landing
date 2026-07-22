import Link from "next/link";
import CampaignForm from "@/components/ugc/marca/CampaignForm";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function NuevaCampanaPage() {
  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <Link href="/ugc/marca/ugc" className={styles.backBtn}>
        <QosIcon name="chevL" size={16} />
        Mis campañas
      </Link>

      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h1 className={styles.tbTitle} style={{ fontSize: "28px" }}>
          Nueva campaña
        </h1>
        <p style={{ marginTop: "8px", color: "var(--ink-2)" }}>
          Publicala para que los creadores la vean, o guardala como borrador y publicala más tarde.
        </p>
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <CampaignForm />
      </div>
    </div>
  );
}
