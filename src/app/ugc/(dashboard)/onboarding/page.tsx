import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm, {
  type ValoresCreador,
  type ValoresMarca,
} from "@/components/ugc/OnboardingForm";
import { estadoCuenta, RUTA_PENDIENTE } from "@/lib/ugc/estado-cuenta";
import { ROLE_DASHBOARD } from "@/lib/ugc/roles";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role: roleParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, city, bio")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect(ROLE_DASHBOARD.admin);
  }

  // Quien ya completó el registro vuelve acá para CORREGIR lo que puso mientras
  // espera la verificación — es la única pantalla donde puede tocar sus datos,
  // porque el panel está cerrado hasta que lo verifiquen.
  //
  // Las otras dos salidas: si ya está verificado no tiene nada que hacer acá, y
  // si lo rechazaron no puede reeditar. Sin esa segunda regla el rechazo no
  // serviría de nada: cualquier cuenta rechazada se maquillaría y volvería a la
  // cola de revisión para siempre.
  let valoresCreador: ValoresCreador | undefined;
  let valoresMarca: ValoresMarca | undefined;
  let editando = false;

  if (profile?.role === "creator") {
    const { data: creator } = await supabase
      .from("creator_profiles")
      .select("handle, instagram_handle, tiktok_handle, niches, followers_count, verified, rejected_at")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (creator) {
      const estado = estadoCuenta(creator);
      if (estado !== "pendiente") {
        redirect(estado === "verificada" ? ROLE_DASHBOARD.creator : RUTA_PENDIENTE);
      }
      editando = true;
      valoresCreador = {
        handle: creator.handle ?? "",
        instagram: creator.instagram_handle ?? "",
        tiktok: creator.tiktok_handle ?? "",
        city: profile.city ?? "",
        bio: profile.bio ?? "",
        niches: (creator.niches ?? []).join(", "),
        followers: creator.followers_count ? String(creator.followers_count) : "",
      };
    }
  } else if (profile?.role === "brand") {
    const { data: brand } = await supabase
      .from("brand_profiles")
      .select("brand_name, industry, website, description, location, verified, rejected_at")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (brand) {
      const estado = estadoCuenta(brand);
      if (estado !== "pendiente") {
        redirect(estado === "verificada" ? ROLE_DASHBOARD.brand : RUTA_PENDIENTE);
      }
      editando = true;
      valoresMarca = {
        brandName: brand.brand_name ?? "",
        industry: brand.industry ?? "",
        location: brand.location ?? "",
        description: brand.description ?? "",
        website: brand.website ?? "",
      };
    }
  }

  const lockedRole = (profile?.role as "creator" | "brand" | null) ?? null;
  const initialRole = lockedRole ?? (roleParam === "brand" ? "brand" : "creator");

  return (
    <div className="flex min-h-screen flex-col bg-lavender/40">
      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2 text-lg font-extrabold text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          UGC·CRC
        </div>
        {editando && (
          <Link
            href={RUTA_PENDIENTE}
            className="text-sm font-semibold text-ink-soft transition hover:text-ink"
          >
            ← Volver
          </Link>
        )}
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <OnboardingForm
          lockedRole={lockedRole}
          initialRole={initialRole}
          valoresCreador={valoresCreador}
          valoresMarca={valoresMarca}
        />
      </main>
    </div>
  );
}
