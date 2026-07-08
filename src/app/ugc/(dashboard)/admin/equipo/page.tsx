import { createClient } from "@/lib/supabase/server";
import { upsertStaffMemberAction, setStaffActiveAction, deleteStaffMemberAction } from "@/lib/actions/staff";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import InviteStaffForm from "@/components/ugc/admin/InviteStaffForm";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import type { StaffRole } from "@/lib/database.types";
import styles from "../qos.module.css";

export const dynamic = "force-dynamic";

const STAFF_ROLES = Object.keys(STAFF_ROLE_LABEL) as StaffRole[];

export default async function EquipoPage() {
  const supabase = await createClient();

  const [{ data: adminProfiles }, { data: staffMembers }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("role", "admin"),
    supabase.from("staff_members").select("*").order("created_at", { ascending: true }),
  ]);

  const staffByProfileId = new Map((staffMembers ?? []).map((s) => [s.profile_id, s]));
  const profileById = new Map((adminProfiles ?? []).map((p) => [p.id, p]));
  const unassignedAdmins = (adminProfiles ?? []).filter((p) => !staffByProfileId.has(p.id));

  return (
    <div>
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
        <div className={styles.sectionHead}>
          <h2>Integrantes ({staffMembers?.length ?? 0})</h2>
        </div>
        {(staffMembers ?? []).map((staff) => (
          <div key={staff.profile_id} className={styles.attnItem} style={{ cursor: "default" }}>
            <span className={styles.dot} style={{ background: staff.color, width: "10px", height: "10px" }} />
            <div className={styles.attnBody}>
              <div className={styles.attnTitle}>{profileById.get(staff.profile_id)?.display_name ?? "Sin nombre"}</div>
              <div className={styles.attnMeta}>{STAFF_ROLE_LABEL[staff.staff_role]}</div>
            </div>
            <form action={setStaffActiveAction}>
              <input type="hidden" name="profile_id" value={staff.profile_id} />
              <input type="hidden" name="active" value={(!staff.active).toString()} />
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnSm} ${staff.active ? styles.btnGhost : styles.btnPrimary}`}
              >
                {staff.active ? "Desactivar" : "Activar"}
              </button>
            </form>
            <ConfirmDeleteButton
              action={deleteStaffMemberAction.bind(null, staff.profile_id)}
              confirmMessage={`¿Borrar definitivamente a ${profileById.get(staff.profile_id)?.display_name ?? "este colaborador"}? Esto elimina su cuenta por completo. No se puede deshacer.`}
              className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            >
              Borrar
            </ConfirmDeleteButton>
          </div>
        ))}
      </div>

      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: unassignedAdmins.length > 0 ? "20px" : 0 }}>
        <div className={styles.sectionHead}>
          <h2>Invitar colaborador</h2>
        </div>
        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "16px" }}>
          Le llega un email para definir su contraseña; queda con rol admin y el staff_role elegido acá.
        </p>
        <InviteStaffForm />
      </div>

      {unassignedAdmins.length > 0 && (
        <div className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.sectionHead}>
            <h2>Promover cuenta admin existente</h2>
          </div>
          <form action={upsertStaffMemberAction} style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
            <div className={styles.field} style={{ flex: 1, minWidth: "180px" }}>
              <label>Cuenta admin</label>
              <select name="profile_id" className={styles.inp}>
                {unassignedAdmins.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name ?? p.id}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field} style={{ flex: 1, minWidth: "180px" }}>
              <label>Rol</label>
              <select name="staff_role" className={styles.inp}>
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {STAFF_ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Color</label>
              <input type="color" name="color" defaultValue="#705CF6" style={{ height: "42px", width: "56px" }} />
            </div>

            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Agregar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
