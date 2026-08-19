import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QosLoginForm from "@/components/ugc/admin/QosLoginForm";
import { destinoDeSesion, destinoConNext } from "@/lib/ugc/estado-cuenta";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Q·OS — Acceso del equipo",
  // El panel interno no tiene por qué aparecer en Google.
  robots: { index: false, follow: false },
};

export default async function QosLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión abierta esta pantalla no tiene nada que preguntar. `destinoDeSesion`
  // manda a cada quien a su panel, así que una cuenta de creador que llegue acá
  // sale para /ugc/creador sin ver la puerta del equipo.
  if (user) {
    redirect(destinoConNext(await destinoDeSesion(supabase, user.id), next));
  }

  // `qosRoot` es obligatorio: qos.module.css escapa todos sus selectores de
  // elemento (input, button, label) bajo esa clase para no filtrarse al resto
  // de la app. Sin ella el formulario sale sin estilo.
  return (
    <div
      className={styles.qosRoot}
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(1100px 520px at 50% -10%, var(--b-100), transparent 70%), var(--canvas)",
      }}
    >
      <main style={{ width: "100%", maxWidth: "372px" }}>
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/favicon-logo.png"
            alt=""
            width={44}
            height={44}
            style={{ borderRadius: "var(--r-md)", objectFit: "cover", boxShadow: "var(--sh-md)" }}
          />
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "12px 0 4px",
            }}
          >
            Q·OS
          </h1>
          <p style={{ margin: 0, color: "var(--ink-2)", fontSize: "13.5px" }}>Acceso del equipo</p>
        </div>

        <div className={`${styles.card} ${styles.cardPad}`} style={{ boxShadow: "var(--sh-lg)" }}>
          <QosLoginForm next={next} />
        </div>

        {/* Sin link de registro a propósito: al equipo lo da de alta un director
            desde Equipo → Invitar, y la invitación llega por correo. */}
        <p
          style={{
            textAlign: "center",
            margin: "16px 0 0",
            fontSize: "12.5px",
            color: "var(--ink-3)",
          }}
        >
          ¿No tenés acceso? Pedile la invitación a un director del equipo.
        </p>
      </main>
    </div>
  );
}
