import { createClient } from "@/lib/supabase/server";
import SubirPieza from "@/components/ugc/creador/SubirPieza";
import PortfolioGrid, { type PortfolioTile } from "@/components/ugc/creador/PortfolioGrid";
import { PORTFOLIO_BUCKET } from "@/lib/ugc/portfolio";
import styles from "@/styles/qos.module.css";
import PantallaHeader from "@/components/ugc/PantallaHeader";

export const dynamic = "force-dynamic";

/** Lo que se le dice a alguien con el book vacío. No es data: es criterio. */
const CONSEJOS = [
  "Piezas verticales, como las publicás de verdad",
  "Mezclá comida, ambiente y algo con vos en cámara",
  "Poné los views si los tenés: ayuda a que te elijan",
];

export default async function CreatorBookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: items }, { data: applications }] = await Promise.all([
    supabase
      .from("portfolio_items")
      .select("*")
      .eq("creator_id", user!.id)
      .order("position", { ascending: true }),
    supabase.from("applications").select("status, rating").eq("creator_id", user!.id),
  ]);

  const tiles: PortfolioTile[] = (items ?? []).map((item) => ({
    id: item.id,
    url: supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(item.storage_path).data.publicUrl,
    media_type: item.media_type,
    category: item.category,
    caption: item.caption,
    views: item.views,
    created_at: item.created_at,
  }));

  const totalViews = tiles.reduce((sum, t) => sum + (t.views ?? 0), 0);
  const entregadas = (applications ?? []).filter(
    (a) => a.status === "delivered" || a.status === "approved"
  ).length;
  const ratings = (applications ?? []).map((a) => a.rating).filter((r): r is number => r != null);
  const promedio = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;

  if (tiles.length === 0) {
    return (
      <div>
        <PantallaHeader titulo="Mi book" />

        <div className={styles.bookVacio}>
          {/* Tres huecos: dicen cuántas piezas se esperan sin tener que leerlo. */}
          <div className={styles.bookHuecos} aria-hidden>
            <span className={styles.bookHueco} />
            <span className={styles.bookHueco} />
            <span className={`${styles.bookHueco} ${styles.bookHuecoMas}`}>+</span>
          </div>
          <h2 className={styles.vacioTitulo}>Subí 3 piezas para empezar</h2>
          {/* NO dice "con tres ya podés aplicar": aplicar solo exige estar
              verificado, y prometer un desbloqueo que no existe es peor que no
              empujar nada. Lo que sí es cierto —y es el argumento real— es que
              la marca mira el book antes de decidir. */}
          <p className={styles.vacioTexto}>
            Las marcas miran tu book antes de aceptarte. Con tres piezas ya se hacen una idea de cómo
            grabás.
          </p>
          <SubirPieza etiqueta="Subir mi primera pieza" />
        </div>

        <div className={styles.bookConsejos}>
          <h3 className={styles.bookConsejosTitulo}>Qué funciona bien acá</h3>
          <ol className={styles.bookConsejosLista}>
            {CONSEJOS.map((c, i) => (
              <li key={c}>
                <span className={styles.bookConsejoNum}>{i + 1}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PantallaHeader
        titulo="Mi book"
        descripcion="Las marcas lo miran al revisar tu aplicación."
        accion={<SubirPieza etiqueta="Subir" />}
      />

      {/* Las tres en una tarjeta y no en tres: a 393 px, tres tarjetas sueltas
          quedan de ~110 px y el número deja de leerse de un vistazo. */}
      <div className={styles.bookStats}>
        <div className={styles.bookStat}>
          <strong>{totalViews > 0 ? totalViews.toLocaleString("es-CR") : "—"}</strong>
          <span>views del book</span>
        </div>
        <div className={styles.bookStat}>
          <strong>{entregadas}</strong>
          <span>piezas entregadas</span>
        </div>
        <div className={styles.bookStat}>
          <strong className={promedio != null ? styles.bookStatRating : undefined}>
            {promedio != null ? `${promedio.toFixed(1)}/5` : "—"}
          </strong>
          <span>rating promedio</span>
        </div>
      </div>

      <PortfolioGrid items={tiles} />
    </div>
  );
}
