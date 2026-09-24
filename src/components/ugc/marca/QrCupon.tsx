import { cambiarQrAction } from "@/lib/actions/cupones";
import { CF } from "@/lib/cf/copy";
import styles from "@/styles/qos.module.css";

export type QrDeCupon = {
  code: string;
  activo: boolean;
  scans: number;
  signups: number;
  /** El QR como data URL (SVG), generado en el servidor. */
  imagen: string | null;
};

/**
 * El QR de un cupón para clientes, dentro de su tarjeta: lo que la marca
 * imprime o muestra en el celular en la caja. Quien lo escanea se une a
 * Close Friends (o entra, si ya es miembro) y el cupón le queda en la wallet.
 *
 * Escaneos y registros van juntos porque la pregunta de la marca es una sola:
 * "¿la gente que lo mira, se une?".
 */
export default function QrCupon({ qr }: { qr: QrDeCupon }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 14,
        background: "#F6F4FD",
        display: "grid",
        gridTemplateColumns: "112px 1fr",
        gap: 14,
        alignItems: "center",
      }}
    >
      {qr.imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr.imagen}
          alt="QR del cupón"
          width={112}
          height={112}
          style={{ display: "block", borderRadius: 10, background: "#fff", opacity: qr.activo ? 1 : 0.35 }}
        />
      ) : (
        <span />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5 }}>
          QR para tus clientes {qr.activo ? "" : "· apagado"}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.4 }}>
          {qr.scans} {qr.scans === 1 ? "escaneo" : "escaneos"} · {qr.signups}{" "}
          {qr.signups === 1 ? "se unió" : "se unieron"} a {CF.programa}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <a href={`/ugc/marca/qr/${qr.code}?formato=png`} className={styles.mcVerBook} style={{ minHeight: 40 }} download>
            PNG
          </a>
          <a href={`/ugc/marca/qr/${qr.code}?formato=svg`} className={styles.mcVerBook} style={{ minHeight: 40 }} download>
            SVG
          </a>
          <form action={cambiarQrAction}>
            <input type="hidden" name="code" value={qr.code} />
            <input type="hidden" name="activo" value={qr.activo ? "0" : "1"} />
            <button type="submit" className={styles.mcVerBook} style={{ minHeight: 40 }}>
              {qr.activo ? "Apagar QR" : "Prender QR"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
