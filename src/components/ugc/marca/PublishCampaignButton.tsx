"use client";

import { useTransition } from "react";
import { publishCampaignAction } from "@/lib/actions/campaigns";
import { useToast } from "@/components/ugc/Toaster";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * Publicar un borrador desde el detalle de la campaña.
 *
 * Es un componente cliente y no un <form action={...}> suelto porque la acción
 * ahora devuelve el desenlace: sin verificación no se publica, y eso hay que
 * poder decirlo. Antes el botón se apretaba y la pantalla quedaba igual.
 */
export default function PublishCampaignButton({ campaignId }: { campaignId: string }) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleClick() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("campaign_id", campaignId);
      const resultado = await publishCampaignAction(formData);
      if (resultado && "error" in resultado) {
        toast(resultado.error, "error");
        return;
      }
      toast("Campaña publicada — ya la ven los creadores.");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`${styles.btn} ${styles.btnPrimary}`}
    >
      {isPending ? "Publicando…" : "Publicar"}
    </button>
  );
}
