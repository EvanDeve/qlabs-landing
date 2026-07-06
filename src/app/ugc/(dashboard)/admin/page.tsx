import SignOutButton from "@/components/ugc/SignOutButton";

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex items-center gap-2 text-lg font-extrabold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet text-sm text-white">
          Q
        </span>
        UGC·CRC · Admin
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">Panel admin</h1>
      <p className="max-w-md text-ink-soft">
        Verificación de creadores, campañas y aplicaciones se construye en la
        épica 1.7.
      </p>
      <SignOutButton />
    </div>
  );
}
