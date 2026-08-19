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
    <div className={`${styles.qosRoot} ${styles.authPage}`}>
      <main className={styles.authWrap}>
        <div className={styles.authBrand}>
          <div className={styles.authMark}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon-logo.png" alt="" width={34} height={34} />
          </div>
          <h1 className={styles.authTitle}>Q·OS</h1>
          <p className={styles.authSub}>Acceso del equipo</p>
        </div>

        <div className={styles.authCard}>
          <QosLoginForm next={next} />
        </div>

        {/* Sin link de registro a propósito: al equipo lo da de alta un director
            desde Equipo → Invitar, y la invitación llega por correo. */}
        <p className={styles.authFoot}>
          ¿No tenés acceso? Pedile la invitación a un director del equipo.
        </p>
      </main>
    </div>
  );
}
