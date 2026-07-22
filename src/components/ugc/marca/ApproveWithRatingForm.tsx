"use client";

import { useState } from "react";
import { approveApplicationAction } from "@/lib/actions/applications";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function ApproveWithRatingForm({
  applicationId,
  campaignId,
}: {
  applicationId: string;
  campaignId: string;
}) {
  const [rating, setRating] = useState(5);

  return (
    <form
      action={approveApplicationAction}
      style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "16px" }}
    >
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="rating" value={rating} />
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`Calificar con ${n} estrella${n > 1 ? "s" : ""}`}
            className={`${styles.starBtn} ${n <= rating ? styles.starBtnOn : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
        Aprobar entrega
      </button>
    </form>
  );
}
