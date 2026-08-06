import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buscarReclamoPorCodigo } from "@/lib/ugc/loyalty-marca";
import { fechaLarga, LEYENDA_EVENTO } from "@/lib/ugc/loyalty";
import ConfirmarCanje from "@/components/ugc/marca/ConfirmarCanje";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * A dónde lleva el QR del creador.
 *
 * Vive dentro de `(dashboard)/marca` a propósito: así hereda `requireRole`, y
 * escanear sin sesión de marca manda al login en vez de mostrar datos de un
 * canje. El celular que escanea es el de quien atiende, con su cuenta abierta.
 */
export default async function ValidarCodigoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [reclamo, { data: marca }] = await Promise.all([
    buscarReclamoPorCodigo(supabase, decodeURIComponent(code)),
    supabase.from("brand_profiles").select("brand_name").eq("profile_id", user!.id).maybeSingle(),
  ]);

  const nombreMarca = marca?.brand_name ?? "tu negocio";

  return (
    <div style={{ maxWidth: "520px" }}>
      <div className={styles.tbCrumb}>
        <Link href="/ugc/marca/loyalty">Loyalty Loop</Link> · Validar
      </div>
      <h1 className={styles.tbTitle} style={{ fontSize: "24px", marginBottom: "18px" }}>
        Validar canje
      </h1>

      {!reclamo ? (
        <div className={`${styles.card} ${styles.cardPad}`} style={{ borderColor: "var(--risk)" }}>
          <b style={{ color: "var(--risk)" }}>
            No encontramos ese código entre los cupones de {nombreMarca}.
          </b>
          <p style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "6px" }}>
            Cada cuenta valida únicamente los cupones que publicó. Si este cupón es de{" "}
            <b>otro de tus negocios</b>, entrá con esa cuenta y volvé a escanear. Si es de este,
            revisá que el código esté bien digitado.
          </p>
          <Link
            href="/ugc/marca/loyalty"
            className={`${styles.btn} ${styles.btnGhost}`}
            style={{ marginTop: "14px" }}
          >
            Ir a validar a mano
          </Link>
        </div>
      ) : (
        <div className={`${styles.card} ${styles.cardPad}`}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <span
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "50%",
                background: "var(--surface-3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {reclamo.creatorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reclamo.creatorAvatar}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                reclamo.creatorHandle.replace(/^@/, "").slice(0, 2).toUpperCase()
              )}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <b style={{ fontSize: "15px" }}>{reclamo.creatorHandle}</b>
                <span className={`${styles.riskPill} ${styles.riskMuted}`}>{reclamo.creatorLevelName}</span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "2px" }}>
                {reclamo.couponTitle}
              </div>
            </div>
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "15px",
              letterSpacing: "0.08em",
              padding: "8px 12px",
              borderRadius: "10px",
              background: "var(--surface-3)",
              display: "inline-block",
              marginBottom: "14px",
            }}
          >
            {reclamo.code}
          </div>

          {reclamo.esEvento && (
            <div
              style={{
                fontSize: "12px",
                lineHeight: 1.5,
                padding: "10px 12px",
                borderRadius: "10px",
                background: "var(--warn-bg)",
                color: "var(--warn)",
                marginBottom: "14px",
              }}
            >
              🎟️ {LEYENDA_EVENTO}
            </div>
          )}

          {reclamo.status === "canjeado" ? (
            <div>
              <b style={{ color: "var(--warn)" }}>Este código ya fue canjeado.</b>
              <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
                Cada código se quema al confirmarse — un canje por creador por cupón.
              </p>
            </div>
          ) : reclamo.status === "expirado" ? (
            <div>
              <b style={{ color: "var(--warn)" }}>Este código venció.</b>
              <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
                Venció el {fechaLarga(reclamo.expiresAt)}. Si todavía queda stock, el creador puede
                volver a reclamarlo.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: "12.5px", color: "var(--ink-3)", marginBottom: "12px" }}>
                Vence el {fechaLarga(reclamo.expiresAt)}
              </p>
              <ConfirmarCanje code={reclamo.code} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
