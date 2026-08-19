import { requireRole } from "@/lib/auth/require-role";
import StaffProfileForm from "@/components/ugc/admin/StaffProfileForm";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  // requireRole y no requireDirector: cada quien edita lo suyo. La policy
  // profiles_update_own_or_admin es la que impide tocar el perfil de otro.
  const { user, supabase } = await requireRole("admin");

  const [{ data: profile }, { data: staffMember }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
    // Su propia fila: la lee gracias a la policy staff_members_select_self.
    supabase.from("staff_members").select("staff_role, color").eq("profile_id", user.id).maybeSingle(),
  ]);

  return (
    <div>
      <StaffProfileForm
        displayName={profile?.display_name ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        // Alguien con role='admin' que todavía no está en staff_members no
        // tiene color asignado. El violeta de la marca es un default razonable
        // y no deja el círculo transparente.
        color={staffMember?.color ?? "#6d54f3"}
        role={staffMember ? STAFF_ROLE_LABEL[staffMember.staff_role] : "Sin rol asignado"}
      />
    </div>
  );
}
