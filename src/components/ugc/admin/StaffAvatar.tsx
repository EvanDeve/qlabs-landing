import styles from "@/styles/qos.module.css";

/**
 * La cara de un miembro del equipo: foto si subió una, y si no la inicial sobre
 * su color asignado.
 *
 * Existe como componente y no repetido en cada pantalla porque el fallback es
 * lo delicado: la mitad del equipo no va a subir foto nunca, y si cada lugar
 * resuelve ese caso a su manera la misma persona se ve distinta en el tablero,
 * en el calendario y en Equipo — que es exactamente lo que hace que un avatar
 * deje de servir para reconocer a alguien de un vistazo.
 *
 * El color sale de `staff_members.color`, no del nombre: es el mismo que ya
 * usan los puntos del calendario, así que la persona se reconoce por color
 * incluso sin foto.
 */
export default function StaffAvatar({
  name,
  avatarUrl,
  color,
  size = "sm",
}: {
  name: string;
  avatarUrl?: string | null;
  color: string;
  /** sm = 22px (tarjetas y listas), md = 26px (cabeceras). */
  size?: "sm" | "md";
}) {
  // Un nombre vacío no puede dejar el círculo en blanco: se vería como un bug.
  const inicial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className={`${styles.av} ${size === "sm" ? styles.avSm : ""}`}
      style={{ background: color }}
      title={name}
    >
      {avatarUrl ? (
        // next/image no: son URLs de Supabase Storage de dominio variable según
        // el proyecto, y a 22px el optimizador no ahorra nada.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className={styles.avImg} />
      ) : (
        inicial
      )}
    </span>
  );
}
