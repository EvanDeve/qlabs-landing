import { requireMember } from "@/lib/cf/sesion";
import { FEATURE_QS } from "@/lib/cf/flags";
import { CF } from "@/lib/cf/copy";
import PantallaHeader from "@/components/ugc/PantallaHeader";
import styles from "@/styles/qos.module.css";

/**
 * Los Qs están sin definir (2026-09-24): ni saldo, ni recargas, ni lógica. La
 * pestaña existe para que el lugar ya esté en la app. Con `FEATURE_QS` apagado
 * —y hoy no hay nada que prender— se ve "Próximamente".
 */
export default async function QsPage() {
  await requireMember();

  return (
    <>
      <PantallaHeader titulo="Qs" />
      <div className={`${styles.card} ${styles.cardPad}`} style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 40 }} aria-hidden>
          ✨
        </div>
        <div style={{ fontWeight: 800, fontSize: 19, marginTop: 10 }}>Próximamente</div>
        <p style={{ color: "var(--ink-2)", fontSize: 15, lineHeight: 1.5, marginTop: 8 }}>
          {/* Sin promesas de cómo van a funcionar: todavía no está decidido. */}
          {FEATURE_QS ? "Estamos terminando de preparar tus Qs." : `Estamos preparando algo nuevo para los miembros de ${CF.programa}.`}
        </p>
      </div>
    </>
  );
}
