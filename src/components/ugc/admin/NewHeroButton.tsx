"use client";

import { useState } from "react";
import { QosIcon } from "@/lib/ugc/qos-icons";
import NewHeroModal from "./NewHeroModal";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function NewHeroButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ marginBottom: "16px" }}
      >
        <QosIcon name="plus" size={16} />
        Nuevo Hero
      </button>
      {open && <NewHeroModal onClose={() => setOpen(false)} />}
    </>
  );
}
