import { Skel, SkelLineas } from "@/components/ugc/Skeleton";
import styles from "@/styles/qos.module.css";

/**
 * Los esqueletos de Close Friends, uno por pantalla y con la forma real de
 * cada una: si el esqueleto no respeta la silueta (la credencial violeta, las
 * pestañas, las tarjetas con código), la pantalla "salta" al llegar y se nota
 * más que la espera. Usan las mismas clases que las pantallas de verdad.
 *
 * Sirven para lo mismo que en el panel del creador (ver EsqueletoPanel): sin
 * un loading.tsx, un toque en la barra de abajo deja la pantalla anterior
 * congelada hasta que llega todo del servidor.
 */

/** Título grande con su rótulo y la campana, como `PantallaHeader`. */
function Encabezado({ rotulo = false, bajada = false }: { rotulo?: boolean; bajada?: boolean }) {
  return (
    <div className={styles.pantallaHead}>
      <div className={styles.pantallaFila}>
        <div style={{ flex: 1 }}>
          {rotulo && <Skel w={90} h={11} style={{ marginBottom: 8 }} />}
          <Skel w="62%" h={28} />
        </div>
        <Skel w={34} h={34} r={10} />
      </div>
      {bajada && <Skel w="80%" h={14} style={{ marginTop: 10 }} />}
    </div>
  );
}

/** Una tarjeta de cupón de la wallet: marca, fechas, raya y código. */
function TarjetaCupon() {
  return (
    <div className={styles.skTarjeta}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Skel w={44} h={44} r={14} />
        <div style={{ flex: 1 }}>
          <Skel w="64%" h={15} />
          <Skel w="42%" h={12} style={{ marginTop: 7 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 28 }}>
        <Skel w={80} h={26} />
        <Skel w={90} h={26} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skel w={120} h={22} />
        <Skel w={104} h={42} r={999} />
      </div>
    </div>
  );
}

export function EsqueletoInicio() {
  return (
    <div>
      <Encabezado rotulo />
      {/* La credencial: mismo alto y radio que la violeta de verdad. */}
      <Skel h={148} r={22} style={{ marginBottom: 16 }} />
      <Skel w={80} h={12} style={{ margin: "22px 0 12px" }} />
      <TarjetaCupon />
      <Skel w={110} h={12} style={{ margin: "22px 0 12px" }} />
      <div className={styles.skTarjeta}>
        {[0, 1].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skel w={38} h={38} r={12} />
            <Skel w="50%" h={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsqueletoCupones() {
  return (
    <div>
      <Encabezado bajada />
      {/* El control segmentado de "Mis cupones / Disponibles". */}
      <Skel h={44} r={14} style={{ marginBottom: 18 }} />
      <Skel w={70} h={12} style={{ marginBottom: 12 }} />
      <div className={styles.recLista}>
        <TarjetaCupon />
        <TarjetaCupon />
      </div>
    </div>
  );
}

export function EsqueletoPerfil() {
  return (
    <div>
      <Encabezado bajada />
      <Skel w={70} h={12} style={{ margin: "8px 0 12px" }} />
      <div className={styles.skTarjeta}>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skel w={110} h={13} style={{ marginBottom: 8 }} />
            <Skel h={48} r={12} />
          </div>
        ))}
        <Skel h={46} r={999} />
      </div>
      <Skel w={70} h={12} style={{ margin: "22px 0 12px" }} />
      <div className={styles.skTarjeta}>
        {[0, 1].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skel w={38} h={38} r={12} />
            <div style={{ flex: 1 }}>
              <SkelLineas n={2} h={12} gap={7} />
            </div>
            <Skel w={22} h={22} r={6} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsqueletoQs() {
  return (
    <div>
      <Encabezado />
      <div className={styles.skTarjeta} style={{ alignItems: "center", padding: "40px 24px" }}>
        <Skel w={44} h={44} circle />
        <Skel w={130} h={18} />
        <Skel w="80%" h={13} />
      </div>
    </div>
  );
}

/**
 * Las pantallas públicas (QR, registro, entrar) van con el lenguaje de la
 * landing y no con el del panel: Tailwind y `animate-pulse`, sobre lavanda.
 */
export function EsqueletoPublico({ forma }: { forma: "qr" | "registro" | "entrar" }) {
  const b = "animate-pulse rounded-card bg-lavender-deep";
  if (forma === "entrar") {
    return (
      <main aria-hidden className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-6">
        <div className={`${b} h-6 w-32 rounded-md`} />
        <div className={`${b} mt-12 h-8 w-52`} />
        <div className={`${b} mt-3 h-4 w-full`} />
        <div className={`${b} mt-2 h-4 w-3/4`} />
        <div className={`${b} mt-8 h-12 w-full rounded-xl`} />
        <div className={`${b} mt-4 h-12 w-full rounded-pill`} />
      </main>
    );
  }
  const conFormulario = forma === "registro";
  return (
    <main aria-hidden className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-6">
      <div className={`${b} h-6 w-32 rounded-md`} />
      <div className={`${b} mt-8 h-[72px] w-[72px] rounded-[20px]`} />
      <div className={`${b} mt-6 h-8 w-40`} />
      <div className={`${b} mt-2 h-8 w-56`} />
      {conFormulario ? (
        <div className="mt-8 flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className={`${b} h-4 w-28`} />
              <div className={`${b} mt-2 h-12 w-full rounded-xl`} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={`${b} mt-6 h-28 w-full`} />
          <div className="mt-6 flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${b} h-14 w-full`} />
            ))}
          </div>
        </>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-8">
        <div className={`${b} h-12 w-full rounded-pill`} />
        {!conFormulario && <div className={`${b} h-12 w-full rounded-pill`} />}
      </div>
    </main>
  );
}
