import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/actions/auth";
import { estadoCuenta } from "@/lib/ugc/estado-cuenta";
import { ROLE_DASHBOARD } from "@/lib/ugc/roles";
import { LEGAL } from "@/lib/legal";

export const dynamic = "force-dynamic";

// El canal de contacto real del negocio. Se prefiere el correo legal en cuanto
// exista (hoy sigue en null — ver el pendiente de datos registrales); mientras
// tanto, la agenda que ya usa la landing de marketing.
const CALENDLY_URL = "https://calendly.com/puravidarepublic/aas-pov";
const CONTACTO = LEGAL.contactoEmail
  ? { href: `mailto:${LEGAL.contactoEmail}`, label: "Escribinos" }
  : { href: CALENDLY_URL, label: "Agendá una llamada con nosotros" };

const PASOS = [
  "Revisamos que el perfil sea real y que encaje con lo que buscan las marcas.",
  "Te escribimos por correo con la respuesta.",
  "Si te aprobamos, entrás al panel con la misma cuenta.",
];

export default async function PendientePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role) {
    redirect("/ugc/onboarding");
  }

  // Un admin no pasa por verificación y no tiene fila que mirar.
  if (profile.role === "admin") {
    redirect(ROLE_DASHBOARD.admin);
  }

  const esCreador = profile.role === "creator";
  const { data: fila } = await supabase
    .from(esCreador ? "creator_profiles" : "brand_profiles")
    .select("verified, rejected_at, rejection_reason")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!fila) {
    redirect("/ugc/onboarding");
  }

  // Ya lo verificaron mientras tenía esta pantalla abierta: que no quede
  // encerrado acá por un refresh.
  const estado = estadoCuenta(fila);
  if (estado === "verificada") {
    redirect(ROLE_DASHBOARD[profile.role]);
  }

  const rechazada = estado === "rechazada";
  const queSos = esCreador ? "tu perfil de creador" : "tu negocio";

  return (
    <div className="flex min-h-screen flex-col bg-lavender/40">
      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <Link href="/ugc" className="flex items-center gap-2 text-lg font-extrabold text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          UGC·CRC
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm font-semibold text-ink-soft transition hover:text-ink"
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-md rounded-[22px] border border-line bg-white p-7 shadow-[0_30px_70px_-40px_rgba(11,11,18,0.35)] sm:p-9">
          <div
            className={`mx-auto mb-6 flex w-fit items-center gap-2 rounded-pill px-3.5 py-1.5 text-sm font-semibold ${
              rechazada
                ? "bg-coral/10 text-coral"
                : "border border-violet/20 bg-lavender text-ink-soft"
            }`}
          >
            {rechazada ? "Cuenta no aprobada" : "En revisión"}
          </div>

          {rechazada ? (
            <>
              <h1 className="text-center text-2xl font-extrabold leading-tight text-ink">
                No pudimos aprobar tu cuenta
              </h1>
              <p className="mt-3 text-center text-sm leading-relaxed text-ink-soft">
                Revisamos {queSos} y por ahora no vamos a poder darte acceso a UGC·CRC.
              </p>

              {fila.rejection_reason && (
                <div className="mt-6 rounded-card border border-line bg-lavender/60 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    Motivo
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">{fila.rejection_reason}</p>
                </div>
              )}

              <p className="mt-6 text-center text-sm leading-relaxed text-ink-soft">
                Si creés que es un error, contanos y lo miramos de nuevo.
              </p>
              <a
                href={CONTACTO.href}
                target={CONTACTO.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center rounded-xl bg-violet py-3.5 text-sm font-bold text-white shadow-[0_10px_26px_-10px_rgba(112,92,246,0.7)] transition hover:bg-violet-deep"
              >
                {CONTACTO.label}
              </a>
            </>
          ) : (
            <>
              <h1 className="text-center text-2xl font-extrabold leading-tight text-ink">
                Tu cuenta está en revisión
              </h1>
              <p className="mt-3 text-center text-sm leading-relaxed text-ink-soft">
                Ya recibimos {queSos}. Verificamos una por una las cuentas que entran a UGC·CRC:
                es lo que hace que del otro lado haya gente real.
              </p>

              <ol className="mt-6 flex flex-col gap-3">
                {PASOS.map((paso, i) => (
                  <li key={paso} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavender-deep text-xs font-bold text-violet-deep">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-ink-soft">{paso}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-7 rounded-card border border-line bg-lavender/60 p-4 text-center">
                <p className="text-sm leading-relaxed text-ink-soft">
                  ¿Te faltó algo o te equivocaste en un dato? Corregilo — mientras estés en
                  revisión, podés cambiar lo que pusiste.
                </p>
                <Link
                  href="/ugc/onboarding"
                  className="mt-3 inline-flex items-center justify-center rounded-pill border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition hover:border-violet hover:text-violet-deep"
                >
                  Revisá tus datos
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 pb-8 text-xs text-ink-soft">
        <Link href="/legal/terminos" className="font-semibold transition hover:text-ink">
          Términos y condiciones
        </Link>
        <Link href="/legal/privacidad" className="font-semibold transition hover:text-ink">
          Política de privacidad
        </Link>
      </footer>
    </div>
  );
}
