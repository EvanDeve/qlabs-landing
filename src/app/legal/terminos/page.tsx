import type { Metadata } from "next";
import Link from "next/link";
import Dato, { Contacto, SiHay } from "@/components/legal/Dato";
import { LEGAL, COMISION_PORCENTAJE, PAGO_CREADOR_PORCENTAJE } from "@/lib/legal";

// ⚠️ BORRADOR PENDIENTE DE REVISIÓN LEGAL (redactado 2026-07-27).
//
// Este texto describe lo que el sistema hace HOY de verdad — la comisión de
// payout.ts, los derechos de uso del enum campaign_usage_*, las transiciones
// que permite el trigger enforce_application_transition. No inventa reglas de
// negocio que no existan en el código.
//
// Lo que SÍ necesita un abogado: la redacción de las cláusulas de limitación de
// responsabilidad, la relación laboral (los creadores son independientes, no
// empleados) y el cumplimiento fino de la Ley 8968. Si el modelo de negocio
// cambia, este documento y el código tienen que moverse juntos.

export const metadata: Metadata = {
  title: "Términos y condiciones — UGC·CRC",
  description:
    "Reglas de uso del marketplace UGC·CRC: campañas, pagos, derechos de uso del contenido, cancelaciones y disputas.",
};

export default function TerminosPage() {
  return (
    <article className="legal-prose">
      <header className="mb-10 border-b border-line pb-8">
        <h1 className="text-3xl font-extrabold leading-tight text-ink md:text-4xl">
          Términos y condiciones
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          Versión {LEGAL.version} · Vigente desde el {LEGAL.vigenciaDesde}
        </p>
      </header>

      <p>
        Estos términos regulan el uso de <strong>{LEGAL.marketplace}</strong>, el marketplace de
        contenido generado por creadores operado por {LEGAL.nombreComercial} en Costa Rica. Al
        crear una cuenta, aplicar a una campaña o publicar una, aceptás lo que sigue.
      </p>

      <h2 id="quienes-somos">1. Quiénes somos</h2>
      <p>
        {LEGAL.marketplace} es operado por{" "}
        <strong>{LEGAL.razonSocial ?? LEGAL.nombreComercial}</strong>
        <SiHay valor={LEGAL.cedulaJuridica}>
          , cédula jurídica <Dato valor={LEGAL.cedulaJuridica} campo="cédula jurídica" />
        </SiHay>
        <SiHay valor={LEGAL.domicilio}>
          , con domicilio en <Dato valor={LEGAL.domicilio} campo="domicilio social" />
        </SiHay>{" "}
        (en adelante, &ldquo;{LEGAL.nombreComercial}&rdquo;, &ldquo;nosotros&rdquo;).
      </p>
      <p>
        Para cualquier consulta sobre estos términos escribinos a{" "}
        <Contacto />.
      </p>

      <h2 id="que-es">2. Qué es {LEGAL.marketplace} y qué no es</h2>
      <p>
        {LEGAL.marketplace} conecta <strong>negocios</strong> (restaurantes, hoteles, sodas y
        similares) con <strong>creadores de contenido</strong> para producir piezas de video y foto
        por encargo.
      </p>
      <p>
        {LEGAL.nombreComercial} actúa como <strong>intermediario</strong>: publicamos las campañas,
        verificamos las cuentas, coordinamos el pago y resolvemos las disputas. No somos el autor
        del contenido ni el empleador del creador.
      </p>
      <div className="legal-callout">
        <p>
          <strong>Los creadores son independientes.</strong> Aplicar y entregar contenido en{" "}
          {LEGAL.marketplace} no crea una relación laboral con {LEGAL.nombreComercial} ni con la
          marca. No hay subordinación, horario ni exclusividad; cada creador decide a qué campañas
          aplica y asume sus propias obligaciones tributarias.
        </p>
      </div>

      <h2 id="cuentas">3. Cuentas y verificación</h2>
      <p>
        Para usar {LEGAL.marketplace} tenés que ser mayor de 18 años, registrarte con datos reales y
        elegir un rol: <strong>negocio</strong> o <strong>creador</strong>. Cada cuenta tiene un solo
        rol y no se puede cambiar después.
      </p>
      <p>
        Todas las cuentas pasan por una <strong>verificación manual</strong> de nuestro equipo antes
        de poder operar. Es un bloqueo real, no un sello:
      </p>
      <ul>
        <li>Un negocio sin verificar no puede publicar campañas.</li>
        <li>Un creador sin verificar no puede aplicar a campañas.</li>
      </ul>
      <p>
        Verificamos para confirmar que el negocio existe y que el creador es quien dice ser.
        Podemos pedir información adicional, y podemos retirar la verificación si detectamos datos
        falsos, suplantación o incumplimientos repetidos. No garantizamos plazos de verificación ni
        estamos obligados a aprobar toda cuenta que se registre.
      </p>

      <h2 id="campanas">4. Cómo funciona una campaña</h2>
      <ol>
        <li>
          <strong>La marca publica.</strong> Define el brief, el formato de las piezas, el
          presupuesto, el plazo de entrega y los derechos de uso del contenido.
        </li>
        <li>
          <strong>El creador aplica.</strong> El brief completo solo lo ven creadores verificados con
          sesión iniciada; la vista pública muestra únicamente marca, título, formato y categoría.
        </li>
        <li>
          <strong>La marca acepta o rechaza.</strong> Aceptar una aplicación es el compromiso de
          pagar lo pactado si la entrega cumple el brief.
        </li>
        <li>
          <strong>El creador entrega</strong> dentro del plazo, subiendo el archivo final y, cuando
          corresponda, el link de la publicación.
        </li>
        <li>
          <strong>La marca aprueba.</strong> Con la aprobación se libera el pago.
        </li>
      </ol>
      <p>
        Los plazos y las condiciones específicas de cada campaña las define la marca en el brief.
        Ante contradicción entre el brief y estos términos, mandan estos términos.
      </p>

      <h2 id="pagos">5. Dinero: precios, comisión y pago</h2>
      <div className="legal-callout">
        <p>
          <strong>
            La marca paga el 100 % del presupuesto a {LEGAL.nombreComercial}.{" "}
            {LEGAL.nombreComercial} retiene una comisión del {COMISION_PORCENTAJE} % y le paga al
            creador el {PAGO_CREADOR_PORCENTAJE} % restante.
          </strong>
        </p>
        <p>
          Por eso los montos que ve el creador en la plataforma ya son netos: es lo que va a
          recibir, sin descuentos posteriores.
        </p>
      </div>
      <p>
        Los montos están en colones costarricenses. El pago se coordina{" "}
        <strong>por fuera de la plataforma</strong>: hoy {LEGAL.marketplace} no procesa pagos ni
        retiene fondos en custodia. {LEGAL.nombreComercial} le cobra a la marca y le transfiere al
        creador una vez aprobada la entrega.
      </p>
      <p>
        Cada parte es responsable de sus propias obligaciones tributarias, incluida la facturación
        electrónica cuando corresponda.
      </p>
      <p>
        Algunas campañas ofrecen <strong>compensación en especie</strong> (producto o servicio
        gratis) además del monto. Cuando existe, se muestra en la campaña antes de aplicar.
      </p>

      <h2 id="derechos-de-uso">6. Derechos de uso del contenido</h2>
      <p>
        El creador es el <strong>autor</strong> de las piezas que produce y conserva sus derechos
        morales, que en Costa Rica son irrenunciables. Lo que la marca recibe es una{" "}
        <strong>licencia de uso</strong> con el alcance y la duración que ella misma definió al
        publicar la campaña, y que el creador aceptó al aplicar.
      </p>

      <h3>Alcance</h3>
      <ul>
        <li>
          <strong>Solo redes de la marca</strong> — la marca publica la pieza en sus propias redes,
          sin pagar para promocionarla.
        </li>
        <li>
          <strong>Orgánico + pauta</strong> — además de sus redes, la marca puede invertir en
          anuncios con esta pieza.
        </li>
        <li>
          <strong>Cualquier medio</strong> — sin límite de canal: web, correo, pantallas en local,
          vallas, lo que sea.
        </li>
      </ul>

      <h3>Duración</h3>
      <p>
        3 meses, 6 meses, 12 meses o permanente, contados desde la aprobación de la entrega.
        Vencida la licencia, la marca debe dejar de usar la pieza en los canales licenciados.
      </p>

      <h3>Edición</h3>
      <p>
        Cada campaña indica si la marca puede editar la pieza (recortar, subtitular, cambiar música)
        o si debe usarla tal como se entregó.
      </p>

      <div className="legal-callout">
        <p>
          <strong>El creador siempre puede publicar la pieza en su propio perfil</strong> y usarla
          como portafolio. Es una regla fija de la plataforma: ninguna campaña puede quitarla.
        </p>
        <p>
          <strong>Campañas sin derechos especificados.</strong> Las campañas publicadas antes de que
          existiera este campo no tienen alcance ni duración pactados. En esos casos{" "}
          <strong>no se asume nada a favor de la marca</strong>: las partes deben acordarlo por
          escrito antes de la entrega.
        </p>
      </div>

      <p>
        La licencia se activa <strong>con el pago</strong>. Si la marca no paga, no adquiere derecho
        de uso sobre la pieza.
      </p>

      <h2 id="obligaciones-creador">7. Obligaciones del creador</h2>
      <ul>
        <li>Producir contenido <strong>original y propio</strong>, sin material de terceros.</li>
        <li>
          Tener autorización de toda persona identificable que aparezca en la pieza, y usar música
          con licencia que permita el uso comercial pactado.
        </li>
        <li>Cumplir el brief y el plazo, o avisar a tiempo si no va a poder.</li>
        <li>
          <strong>Identificar el contenido como publicidad</strong> cuando la ley o la plataforma
          social lo exijan (por ejemplo, la etiqueta de colaboración pagada).
        </li>
        <li>No inventar experiencias ni afirmaciones falsas sobre el producto o servicio.</li>
        <li>Mantener actualizados sus datos de perfil y sus métricas.</li>
      </ul>

      <h2 id="obligaciones-marca">8. Obligaciones de la marca</h2>
      <ul>
        <li>Publicar briefs claros, con presupuesto y plazo reales.</li>
        <li>Responder las aplicaciones y revisar las entregas en un tiempo razonable.</li>
        <li>Pagar lo pactado cuando la entrega cumple el brief.</li>
        <li>Usar el contenido solo dentro del alcance, la duración y las condiciones de edición pactadas.</li>
        <li>
          No pedirle al creador afirmaciones falsas, engañosas o que incumplan la normativa de
          publicidad y protección al consumidor.
        </li>
        <li>No contactar al creador para saltarse la plataforma en la misma campaña.</li>
      </ul>

      <h2 id="cancelacion">9. Cancelación y disputas</h2>
      <div className="legal-callout">
        <p>
          <strong>Se puede cancelar mientras no haya entrega.</strong> Una vez que hay material
          entregado ya no es cancelación sino <strong>disputa</strong>, porque hay trabajo hecho y
          dinero de por medio.
        </p>
      </div>
      <p>Concretamente:</p>
      <ul>
        <li>
          <strong>Antes de la entrega</strong> — tanto la marca como el creador pueden cancelar una
          aplicación aceptada, indicando el motivo. No hay pago.
        </li>
        <li>
          <strong>Después de la entrega</strong> — la marca ya no puede cancelar. Si el material no
          cumple el brief, abre una disputa. El creador también puede abrirla si entregó y no recibe
          respuesta o pago.
        </li>
      </ul>
      <p>
        Las disputas las resuelve {LEGAL.nombreComercial} como intermediario del pago. Revisamos el
        brief, la entrega y la conversación, y decidimos si corresponde el pago total, parcial o
        ninguno. Nuestra decisión es la que aplicamos operativamente, sin perjuicio de que
        cualquiera de las partes acuda a la vía judicial o administrativa que le corresponda.
      </p>
      <p>
        El abuso de las cancelaciones —cancelar de forma reiterada después de aceptar, o entregar
        material que no cumple— puede terminar en la suspensión de la cuenta.
      </p>

      <h2 id="conducta">10. Conducta y suspensión de cuentas</h2>
      <p>Podemos suspender o eliminar una cuenta, sin reembolso de comisiones ya devengadas, si:</p>
      <ul>
        <li>Se registran datos falsos o se suplanta a una persona o negocio.</li>
        <li>Se publica contenido ilegal, discriminatorio, sexual explícito o que acose a alguien.</li>
        <li>Se compran seguidores o se inflan métricas para conseguir campañas.</li>
        <li>Se usa la plataforma para captar usuarios y llevarlos por fuera evitando la comisión.</li>
        <li>Se incumplen estos términos de forma reiterada.</li>
      </ul>

      <h2 id="responsabilidad">11. Responsabilidad</h2>
      <p>
        {LEGAL.marketplace} es un punto de encuentro. No garantizamos que una campaña reciba
        aplicaciones, que un creador sea aceptado, ni el resultado comercial del contenido
        producido.
      </p>
      <p>
        No respondemos por el incumplimiento de la otra parte más allá de nuestro rol como
        intermediario del pago y resolutor de disputas descrito en la sección 9. En la medida que lo
        permita la ley costarricense, nuestra responsabilidad frente a cualquier reclamo se limita al
        monto de la campaña involucrada.
      </p>
      <p>
        Prestamos el servicio &ldquo;tal cual&rdquo;. Podemos modificar, suspender o descontinuar
        funcionalidades, avisando con antelación razonable cuando el cambio afecte campañas en curso.
      </p>

      <h2 id="datos">12. Datos personales</h2>
      <p>
        El tratamiento de datos personales se rige por nuestra{" "}
        <Link href="/legal/privacidad">Política de privacidad</Link>, conforme a la Ley N.º 8968 de
        Protección de la Persona frente al Tratamiento de sus Datos Personales.
      </p>

      <h2 id="cambios">13. Cambios a estos términos</h2>
      <p>
        Podemos actualizar estos términos. Si el cambio es relevante, lo avisamos por correo o dentro
        de la plataforma con al menos 15 días de antelación. Las campañas ya aceptadas se rigen por
        la versión vigente al momento de aceptarse. Seguir usando {LEGAL.marketplace} después de la
        entrada en vigencia implica aceptar la nueva versión.
      </p>

      <h2 id="ley">14. Ley aplicable y jurisdicción</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Costa Rica. Cualquier controversia
        se somete a los tribunales de Costa Rica, sin perjuicio de que intentemos primero resolverla
        de buena fe entre las partes.
      </p>

      <h2 id="contacto">15. Contacto</h2>
      <p>
        Escribinos a <Contacto /> para cualquier
        consulta sobre estos términos, una disputa o el estado de tu cuenta.
      </p>
    </article>
  );
}
