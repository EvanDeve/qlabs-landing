"use client";

import { useTransition } from "react";
import { updateApplicationStatusAction } from "@/lib/actions/applications";
import { useToast } from "@/components/ugc/Toaster";
import { QosIcon } from "@/lib/ugc/qos-icons";
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

  // El orden es rechazar → aceptar y no al revés: en el mockup la ✕ queda entre
  // "Ver book" y "Aceptar", o sea que la acción destructiva no está pegada al
  // borde donde cae el pulgar. Y rechazar va sin texto por lo mismo que en el
  // mockup: con tres botones con palabra, la fila no entra en 393 px.
  return (
    <>
      <button
        type="button"
        onClick={() => decidir("rejected")}
        disabled={isPending}
        className={styles.mcRechazar}
        aria-label={`Rechazar a ${creatorName}`}
        title="Rechazar"
      >
        <QosIcon name="x" size={17} />
      </button>
      <button
        type="button"
        onClick={() => decidir("accepted")}
        disabled={isPending}
        className={styles.mcAceptar}
      >
        Aceptar
      </button>
    </>
  );
}
