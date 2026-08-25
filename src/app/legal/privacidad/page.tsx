import type { Metadata } from "next";
import Link from "next/link";
import Dato, { Contacto, SiHay } from "@/components/legal/Dato";
import { LEGAL } from "@/lib/legal";

// ⚠️ BORRADOR PENDIENTE DE REVISIÓN LEGAL (redactado 2026-07-27).
//
// El detalle de datos recolectados se sacó de las columnas REALES de la base
// (profiles, creator_profiles, brand_profiles, applications, portfolio_items) y
// de los buckets de Storage que existen. Si se agrega una columna o un bucket
// que guarde datos personales nuevos, hay que actualizar la tabla de la
// sección 3 — una política que describe menos de lo que se recoge es
// justamente el incumplimiento que la Ley 8968 castiga.

export const metadata: Metadata = {
  title: "Política de privacidad — UGC·CRC",
  description:
    "Qué datos personales recolecta UGC·CRC, para qué los usa, con quién los comparte y cómo ejercer tus derechos bajo la Ley 8968.",
};

export default function PrivacidadPage() {
  return (
    <article className="legal-prose">
      <header className="mb-10 border-b border-line pb-8">
        <h1 className="text-3xl font-extrabold leading-tight text-ink md:text-4xl">
          Política de privacidad
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          Versión {LEGAL.version} · Vigente desde el {LEGAL.vigenciaDesde}
        </p>
      </header>

      <p>
        Esta política explica qué datos personales tratamos en{" "}
        <strong>{LEGAL.marketplace}</strong> y en {LEGAL.sitio}, para qué los usamos y cómo podés
        controlarlos. Está redactada conforme a la <strong>Ley N.º 8968</strong>, Ley de Protección
        de la Persona frente al Tratamiento de sus Datos Personales, y su reglamento.
      </p>

      <h2 id="responsable">1. Quién es responsable de tus datos</h2>
      <p>
        El responsable de la base de datos es{" "}
        <strong>{LEGAL.razonSocial ?? LEGAL.nombreComercial}</strong>
        <SiHay valor={LEGAL.cedulaJuridica}>
          , cédula jurídica <Dato valor={LEGAL.cedulaJuridica} campo="cédula jurídica" />
        </SiHay>
        <SiHay valor={LEGAL.domicilio}>
          , con domicilio en <Dato valor={LEGAL.domicilio} campo="domicilio social" />
        </SiHay>
        .
      </p>
      <p>
        Para cualquier consulta sobre tus datos, o para ejercer los derechos de la sección 7,
        escribinos a <Contacto />.
      </p>

      <h2 id="consentimiento">2. Tu consentimiento</h2>
      <p>
        Tratamos tus datos con base en el <strong>consentimiento informado</strong> que das al crear
        tu cuenta, y en la ejecución de la relación que se genera al usar el marketplace. El
        consentimiento es libre y podés retirarlo en cualquier momento eliminando tu cuenta, sin que
        eso afecte la licitud del tratamiento anterior.
      </p>
      <p>
        No tratamos datos sensibles (salud, origen étnico, orientación sexual, convicciones
        religiosas o políticas) ni te los pedimos. No los incluyas en tu biografía ni en los
        mensajes de aplicación.
      </p>

      <h2 id="que-datos">3. Qué datos recolectamos</h2>

      <div className="legal-tablewrap">
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Datos concretos</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cuenta</td>
              <td>
                Correo electrónico y contraseña (guardada cifrada, nunca en texto plano), rol
                (creador, negocio o administrador), fecha de registro.
              </td>
            </tr>
            <tr>
              <td>Perfil común</td>
              <td>Nombre visible, ciudad, biografía, foto de perfil.</td>
            </tr>
            <tr>
              <td>Perfil de creador</td>
              <td>
                Handle, cuentas de Instagram y TikTok, cantidad de seguidores, nichos, idiomas,
                rango de tarifas, promedios de vistas, alcance e interacción, estado de
                verificación.
              </td>
            </tr>
            <tr>
              <td>Perfil de negocio</td>
              <td>
                Nombre de la marca, industria, sitio web, cuenta de Instagram, descripción, logo,
                zona, estado de verificación.
              </td>
            </tr>
            <tr>
              <td>Actividad en el marketplace</td>
              <td>
                Campañas publicadas, aplicaciones y su mensaje de presentación, estados y fechas de
                cada etapa, calificaciones, motivos de cancelación o disputa.
              </td>
            </tr>
            <tr>
              <td>Contenido que subís</td>
              <td>
                Piezas del portafolio y archivos de entrega (video, imagen), con sus descripciones y
                cantidad de vistas.
              </td>
            </tr>
            <tr>
              <td>Técnicos</td>
              <td>
                Datos de sesión para mantenerte con la sesión iniciada, y estadísticas agregadas de
                visitas al sitio.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        No pedimos ni almacenamos datos de tarjetas ni cuentas bancarias: el pago se coordina por
        fuera de la plataforma.
      </p>

      <h2 id="para-que">4. Para qué los usamos</h2>
      <ul>
        <li>Crear y sostener tu cuenta, y mantenerte con la sesión iniciada.</li>
        <li>
          <strong>Verificar</strong> que un negocio existe y que un creador es quien dice ser.
        </li>
        <li>Mostrarle tu perfil a la otra parte para que decida si trabaja con vos.</li>
        <li>Operar las campañas: aplicaciones, entregas, aprobaciones y calificaciones.</li>
        <li>Avisarte por correo y dentro de la plataforma cuando pasa algo que te toca.</li>
        <li>Coordinar el cobro y el pago de cada campaña.</li>
        <li>Resolver disputas entre las partes.</li>
        <li>Entender de forma agregada cómo se usa el sitio para mejorarlo.</li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad de terceros.</p>

      <h2 id="quien-los-ve">5. Quién puede ver tus datos</h2>
      <h3>Otras personas usuarias</h3>
      <ul>
        <li>
          <strong>Tu perfil público</strong> —handle o nombre de marca, ciudad o zona, foto o logo,
          biografía, nichos, métricas y portafolio— es visible para cualquier visitante del sitio.
        </li>
        <li>
          <strong>El brief completo de una campaña</strong> solo lo ven creadores verificados con
          sesión iniciada. Al público general le mostramos únicamente marca, título, formato y
          categoría.
        </li>
        <li>
          <strong>Tu aplicación</strong> —mensaje incluido— la ve solamente la marca dueña de esa
          campaña.
        </li>
        <li>
          <strong>El contenido que entregás</strong> lo ve la marca de esa campaña.
        </li>
      </ul>
      <p>
        Estas fronteras no dependen solo de la interfaz: están aplicadas en la base de datos con
        reglas de acceso por fila.
      </p>

      <h3>Nuestro equipo</h3>
      <p>
        El personal de {LEGAL.nombreComercial} con rol de administrador accede a los datos
        necesarios para verificar cuentas, dar soporte y resolver disputas.
      </p>

      <h3>Proveedores que nos prestan servicio</h3>
      <div className="legal-tablewrap">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Para qué</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Base de datos, autenticación y almacenamiento de los archivos que subís.</td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Alojamiento del sitio y estadísticas agregadas de visitas.</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>Envío de los correos de aviso.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Estos proveedores tratan los datos <strong>por cuenta nuestra</strong> y sus servidores están
        fuera de Costa Rica, por lo que existe una{" "}
        <strong>transferencia internacional de datos</strong>. Al aceptar esta política consentís
        esa transferencia, que se realiza bajo los compromisos contractuales de seguridad de cada
        proveedor.
      </p>
      <p>
        También podemos entregar datos cuando lo exija una autoridad judicial o administrativa
        competente.
      </p>

      <h2 id="cuanto-tiempo">6. Cuánto tiempo los guardamos</h2>
      <ul>
        <li>
          <strong>Mientras tengas cuenta activa</strong>, conservamos tu perfil y tu actividad.
        </li>
        <li>
          <strong>Al eliminar tu cuenta</strong>, borramos tu perfil, tus aplicaciones, tu portafolio
          y tus archivos.
        </li>
        <li>
          <strong>Registros de campañas pagadas</strong>: conservamos lo mínimo necesario para
          cumplir obligaciones contables y tributarias, por el plazo que exige la ley costarricense.
        </li>
      </ul>

      <h2 id="derechos">7. Tus derechos</h2>
      <p>La Ley 8968 te reconoce el derecho a:</p>
      <ul>
        <li>
          <strong>Acceder</strong> a los datos que tenemos sobre vos y saber para qué los usamos.
        </li>
        <li>
          <strong>Rectificar</strong> los que estén incorrectos o desactualizados.
        </li>
        <li>
          <strong>Eliminar</strong> los que ya no sean necesarios, o retirar tu consentimiento.
        </li>
        <li>
          <strong>Oponerte</strong> a un tratamiento concreto.
        </li>
      </ul>
      <p>
        Buena parte de esto lo podés hacer solo, desde tu perfil dentro de la plataforma. Para lo
        demás —o para pedir una copia de todos tus datos— escribinos a{" "}
        <Contacto />. Respondemos en un plazo
        máximo de <strong>cinco días hábiles</strong>, como manda la ley.
      </p>
      <p>
        Si considerás que no atendimos tu solicitud como corresponde, podés acudir a la{" "}
        <strong>Agencia de Protección de Datos de los Habitantes (PRODHAB)</strong>.
      </p>

      <h2 id="seguridad">8. Seguridad</h2>
      <p>
        Ciframos el tráfico del sitio, guardamos las contraseñas con algoritmos de hash —nadie de
        nuestro equipo puede leerlas— y limitamos el acceso a los datos con reglas por fila en la
        base, de modo que una cuenta no pueda leer información de otra.
      </p>
      <p>
        Ningún sistema es infalible. Si ocurre una brecha que afecte tus datos, te lo comunicaremos y
        lo reportaremos a PRODHAB conforme a la ley.
      </p>

      <h2 id="menores">9. Menores de edad</h2>
      <p>
        {LEGAL.marketplace} es para mayores de 18 años. No recolectamos datos de menores a
        sabiendas. Si detectamos una cuenta de una persona menor de edad, la eliminamos junto con sus
        datos.
      </p>

      <h2 id="cookies">10. Cookies y tecnologías similares</h2>
      <p>
        Usamos las cookies estrictamente necesarias para mantener tu sesión iniciada. No usamos
        cookies publicitarias ni de seguimiento entre sitios. Las estadísticas de visitas que
        recogemos son agregadas y no te identifican individualmente.
      </p>

      <h2 id="cambios">11. Cambios a esta política</h2>
      <p>
        Si cambiamos la forma en que tratamos tus datos, actualizamos esta página y te avisamos por
        correo o dentro de la plataforma antes de que el cambio entre en vigencia.
      </p>

      <h2 id="contacto">12. Contacto</h2>
      <p>
        Escribinos a <Contacto />. Ver también
        nuestros <Link href="/legal/terminos">Términos y condiciones</Link>.
      </p>
    </article>
  );
}
