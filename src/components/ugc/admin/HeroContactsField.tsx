"use client";

import { useState } from "react";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";
import { QosIcon } from "@/lib/ugc/qos-icons";
import type { HeroContact } from "@/lib/database.types";

export default function HeroContactsField({ defaultValue }: { defaultValue: HeroContact[] }) {
  const [contacts, setContacts] = useState<HeroContact[]>(defaultValue);

  function update(i: number, field: keyof HeroContact, value: string) {
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  function addContact() {
    setContacts((prev) => [...prev, { name: "" }]);
  }

  function removeContact(i: number) {
    setContacts((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <input type="hidden" name="contacts_json" value={JSON.stringify(contacts)} />
      {contacts.map((contact, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: "12px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={() => removeContact(i)}
            aria-label="Quitar contacto"
            className={styles.drawerClose}
            style={{ position: "absolute", top: "8px", right: "8px", width: "22px", height: "22px" }}
          >
            <QosIcon name="x" size={12} />
          </button>
          <input
            placeholder="Nombre"
            value={contact.name}
            onChange={(e) => update(i, "name", e.target.value)}
            className={styles.inp}
          />
          <input
            placeholder="Rol"
            value={contact.role ?? ""}
            onChange={(e) => update(i, "role", e.target.value)}
            className={styles.inp}
          />
          <input
            placeholder="Teléfono"
            value={contact.phone ?? ""}
            onChange={(e) => update(i, "phone", e.target.value)}
            className={styles.inp}
          />
          <input
            placeholder="Email"
            value={contact.email ?? ""}
            onChange={(e) => update(i, "email", e.target.value)}
            className={styles.inp}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addContact}
        className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
        style={{ alignSelf: "flex-start" }}
      >
        <QosIcon name="plus" size={13} />
        Agregar contacto
      </button>
    </div>
  );
}
