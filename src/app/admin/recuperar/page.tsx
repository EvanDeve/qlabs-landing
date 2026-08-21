import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QosRecuperarForm from "@/components/ugc/admin/QosRecuperarForm";
import { destinoDeSesion } from "@/lib/ugc/estado-cuenta";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Q·OS — Recuperar contraseña",
  robots: { index: false, follow: false },
};

export default async function QosRecuperarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión abierta no hay nada que recuperar: la contraseña se cambia
  // desde el perfil, no por correo.
  if (user) {
    redirect(await destinoDeSesion(supabase, user.id));
  }

  // `qosRoot` es obligatorio: qos.module.css escapa todos sus selectores de
  // elemento (input, button, label) bajo esa clase. Sin ella el formulario
  // sale sin estilo.
  return (
    <div className={`${styles.qosRoot} ${styles.authPage}`}>
      <main className={styles.authWrap}>
        <div className={styles.authBrand}>
          <div className={styles.authMark}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon-logo.png" alt="" width={34} height={34} />
          </div>
          <h1 className={styles.authTitle}>Recuperar contraseña</h1>
          <p className={styles.authSub}>Te mandamos un link para crear una nueva</p>
        </div>

        <div className={styles.authCard}>
          <QosRecuperarForm />
        </div>

        <p className={styles.authFoot}>
          <Link href="/admin/login">← Volver al acceso</Link>
        </p>
      </main>
    </div>
  );
}
