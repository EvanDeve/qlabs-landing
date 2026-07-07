import { createClient } from "@/lib/supabase/server";
import PortfolioUploadForm from "@/components/ugc/creador/PortfolioUploadForm";
import PortfolioGrid from "@/components/ugc/creador/PortfolioGrid";
import { PORTFOLIO_BUCKET } from "@/lib/ugc/portfolio";

export const dynamic = "force-dynamic";

export default async function CreatorBookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("creator_id", user!.id)
    .order("position", { ascending: true });

  const tiles = (items ?? []).map((item) => ({
    id: item.id,
    url: supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(item.storage_path).data.publicUrl,
    media_type: item.media_type,
    category: item.category,
    caption: item.caption,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Mi book</h1>
        <p className="mt-1 text-ink-soft">
          Las marcas ven tu book al revisar tu aplicación — mantenelo actualizado con tus mejores piezas.
        </p>
      </div>

      <div className="mb-8">
        <PortfolioUploadForm />
      </div>

      <PortfolioGrid items={tiles} />
    </div>
  );
}
