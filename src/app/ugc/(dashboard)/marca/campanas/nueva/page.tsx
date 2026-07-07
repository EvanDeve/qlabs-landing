import Link from "next/link";
import CampaignForm from "@/components/ugc/marca/CampaignForm";

export default function NuevaCampanaPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-6 px-6 py-16">
      <Link href="/ugc/marca" className="self-start text-sm font-bold text-ink-soft hover:text-ink">
        ← Mis campañas
      </Link>

      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Nueva campaña</h1>
        <p className="max-w-md text-ink-soft">
          Publicala para que los creadores la vean, o guardala como borrador y
          publicala más tarde.
        </p>
      </div>

      <CampaignForm />
    </div>
  );
}
