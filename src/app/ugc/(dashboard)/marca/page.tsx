import SignOutButton from "@/components/ugc/SignOutButton";

export default function MarcaDashboardPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex items-center gap-2 text-lg font-extrabold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet text-sm text-white">
          Q
        </span>
        UGC·CRC
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">
        Bienvenida, marca
      </h1>
      <p className="max-w-md text-ink-soft">
        Tu dashboard (crear campaña, mis campañas, aplicantes) se construye en
        la épica 1.4. Tu cuenta ya está creada y verificada.
      </p>
      <SignOutButton />
    </div>
  );
}
