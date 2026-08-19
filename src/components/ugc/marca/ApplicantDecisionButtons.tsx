"use client";

import { useTransition } from "react";
import { updateApplicationStatusAction } from "@/lib/actions/applications";
import { useToast } from "@/components/ugc/Toaster";
import styles from "@/styles/qos.module.css";

/**
 * Aceptar o rechazar a un aplicante.
 *
 * Las dos decisiones comparten componente para que el botón que se apretó
 * quede en "…" y el otro se apague: aceptar y rechazar viven pegados, y con
 * dos formularios sueltos no había forma de saber cuál estaba corriendo.
 */
export default function ApplicantDecisionButtons({
  applicationId,
  campaignId,
  creatorName,
}: {
  applicationId: string;
  campaignId: string;
  creatorName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function decidir(status: "accepted" | "rejected") {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("application_id", applicationId);
      formData.set("campaign_id", campaignId);
      formData.set("status", status);
      await updateApplicationStatusAction(formData);
      toast(
        status === "accepted"
          ? `Aceptaste a ${creatorName} — le avisamos.`
          : `Rechazaste a ${creatorName} — le avisamos.`
      );
    });
  }

  return (
    <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
      <button
        type="button"
        onClick={() => decidir("accepted")}
        disabled={isPending}
        className={`${styles.btn} ${styles.btnPrimary}`}
      >
        Aceptar
      </button>
      <button
        type="button"
        onClick={() => decidir("rejected")}
        disabled={isPending}
        className={`${styles.btn} ${styles.btnGhost}`}
      >
        Rechazar
      </button>
    </div>
  );
}
