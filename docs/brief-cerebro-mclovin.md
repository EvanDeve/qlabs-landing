# Brief: llenar el cerebro de McLovin

Este documento es para que armes el contenido que va a leer un agente de
WhatsApp llamado **McLovin**, que atiende el número de Q Labs. Vos tenés el
contexto de Q Labs; acá está todo lo que necesitás saber del agente.

Al final hay una lista de preguntas: si no tenés la respuesta, preguntásela a
Evan antes de escribir. Inventar acá tiene consecuencias reales — lo que
escribas es lo único que el agente sabe, y se lo va a decir a potenciales
clientes por WhatsApp.

---

## Qué es McLovin

Un agente que corre sobre Gemini 2.5 Flash y atiende el WhatsApp de Q Labs.
Tiene dos caras:

- **Con el equipo interno**: les recuerda pendientes, conversa y les actualiza el
  tablero. Esa parte ya está resuelta y no la tocamos acá.
- **Con gente de afuera**: alguien que no es del equipo escribe al número. McLovin
  le explica qué es Q Labs y **lo lleva a agendar una reunión** por un link de
  Calendly. No cotiza, no cierra, no agenda él: lleva a la reunión.

**Solo responde a quien le escribe primero.** Nunca inicia una conversación con
un desconocido.

Lo que vos vas a escribir es el contenido editable de esa segunda cara.

---

## Lo que YA está en el código — no lo repitas

Estas reglas se le inyectan al modelo en cada mensaje, siempre, y no se pueden
apagar desde el panel. **Escribirlas de nuevo es desperdiciar espacio y crear
contradicciones.** Dalas por hechas:

**Identidad**
- Si le preguntan si es una persona o un bot, dice que es un asistente
  automático y que el equipo lee la conversación.

**Estilo**
- Español de Costa Rica, voseo. Cordial y breve, sin solemnidad.
- Sin viñetas, sin negritas, sin emojis decorativos.
- Dos o tres líneas por mensaje.
- Una pregunta por mensaje, no tres.

**Prohibiciones**
- No inventa precios, plazos, promociones, casos de éxito ni servicios que no
  estén en el texto que vos escribas.
- No cotiza ni cierra nada.
- No promete que alguien va a llamar, ni a una hora ni en un plazo.
- No pide datos de tarjeta ni contraseñas.
- No insiste: si dicen que no les interesa, agradece y corta.
- Si no sabe algo, lo dice, y pide nombre y de qué negocio es.

**Manejo del link de agenda**
- Lo manda solo cuando hay interés real (pregunta precios, cómo empezar, si le
  sirve a su negocio, o pide hablar con alguien).
- Lo manda **una sola vez**. Si no agendó, sigue conversando en vez de repetirlo.
- Nunca de entrada ni ante una pregunta suelta.
- Antes o junto con el link, pide nombre y de qué negocio es.
- Si no hay link cargado, no inventa uno: dice que el equipo le escribe.

---

## Los campos a llenar

Hay tres. Cada uno tiene un tope de **4.000 caracteres**.

### 1. `sobre_qlabs` — "Qué sabe de Q Labs"

**Son los HECHOS.** Es literalmente todo lo que el agente sabe de la empresa; lo
que no esté acá, para él no existe.

Qué tiene que cubrir:
- Qué es Q Labs y a quién le sirve.
- Los servicios, con el nombre exacto con que la empresa los llama.
- Para qué sirve cada uno, en términos del problema que resuelve — no en términos
  de la solución. "Que no se te pierdan mensajes de Instagram a las 11 de la
  noche" comunica más que "automatización omnicanal".
- **Qué NO hacen.** Tan importante como lo que hacen: sin esto el agente acepta
  cualquier pedido y la reunión arranca con una expectativa falsa.
- Zona geográfica e idiomas.
- UGC·CRC (el marketplace de creadores) y cómo se relaciona con el resto.
- Cualquier caso o cliente que se pueda nombrar públicamente. Si no hay ninguno
  autorizado, no pongas ninguno.

Qué NO poner: precios, plazos de entrega, garantías, promociones, cifras de
resultados que no estén verificadas y publicadas.

### 2. `guion_publico` — "Cómo lleva la conversación"

**Es el COMPORTAMIENTO.** Este es el campo que mueve la aguja en cantidad de
reuniones. Los hechos van arriba; acá va qué hacer con ellos.

Qué tiene que cubrir:
- Qué averiguar primero y en qué orden.
- Cómo adaptar lo que cuenta según el tipo de negocio. Un restaurante que no da
  abasto con los mensajes no necesita lo mismo que un hotel que quiere verse
  mejor que la competencia.
- Qué señales indican que vale la pena llevarlo a la reunión, y cuáles indican
  que no.
- Las objeciones que aparecen siempre y cómo responderlas sin cotizar.
- Qué casos NO son una venta y cómo manejarlos: un cliente actual con un
  problema, un creador de contenido que quiere entrar a UGC·CRC, alguien que se
  equivocó de número, un proveedor.
- Qué información quieren tener antes de que arranque la reunión.

Escribilo como instrucciones a una persona nueva que empieza a atender el chat,
no como una lista de reglas.

### 3. `link_agenda`

La URL de Calendly. Tiene que empezar con `https://` y no llevar espacios — la
base rechaza cualquier otra cosa. Este lo carga Evan, vos no lo inventes.

---

## Cómo escribirlo

- **Prosa corta en español de Costa Rica, con voseo.** El modelo copia el
  registro de lo que lee: si le escribís en español neutro y formal, va a
  contestar en español neutro y formal.
- **Sin markdown.** Nada de `##`, `**`, ni listas con `-`. Párrafos cortos
  separados por una línea en blanco, y encabezados en mayúscula suelta si hacen
  falta. Las viñetas en el prompt tienden a filtrarse a los mensajes, y el agente
  las tiene prohibidas.
- **Concreto sobre abstracto.** "Trabajamos con restaurantes y hoteles en el GAM"
  sirve; "soluciones digitales de alto impacto" no le dice nada al modelo y va a
  producir respuestas igual de vacías.
- **Escribí lo que querés que diga, no lo que querés que sea.** "Explicale que
  primero se hace un diagnóstico" funciona; "sé consultivo" no.

---

## Preguntas que hay que responder antes de escribir

Si Evan no las contestó, pedíselas. Cada una que se responda de memoria es un
riesgo de que el agente afirme algo falso.

**Sobre los servicios**
1. ¿Cuáles son los servicios exactos hoy y cómo los nombran de cara al cliente?
2. ¿Qué problema concreto resuelve cada uno? Un ejemplo real de cada uno.
3. ¿Qué pide la gente que ustedes NO hacen?
4. ¿Hay un servicio de entrada, el que más se vende primero?

**Sobre el cliente**
5. ¿Cuál es el cliente ideal? Tipo de negocio, tamaño, zona.
6. ¿Qué tipo de consulta NO vale una reunión?
7. ¿Qué clientes o casos se pueden nombrar públicamente?

**Sobre la conversación**
8. ¿Qué preguntan siempre antes de comprar, y qué se les contesta?
9. ¿Qué quieren saber de la persona antes de sentarse en la reunión?
10. ¿Qué se hace si escribe un cliente actual con un problema? ¿Y un creador que
    quiere entrar a UGC·CRC?

**Sobre la reunión**
11. ¿De qué es la reunión y cuánto dura? ¿Con quién queda?
12. ¿Es gratuita? ¿Hay que preparar algo antes?

---

## Cómo probar lo que escribas

En `/admin/mclovin`, después de guardar, hay un bloque **"El cerebro
armado"**: muestra el prompt completo tal cual lo lee el modelo, con las reglas
fijas y tu texto juntos. Leelo entero antes de dar por bueno el contenido — ahí
se ven las contradicciones entre lo que escribiste y lo que ya está en código.

Después, desde un número que no sea del equipo:

1. Una pregunta suelta ("¿ustedes qué hacen?") → contesta, **sin** mandar el link.
2. Una señal de interés ("¿cuánto cobran?") → contesta sin cotizar, manda el
   link y pregunta nombre y negocio.
3. Otra pregunta más → **no** vuelve a mandar el link.
4. Algo que no está en el texto ("¿hacen fotografía de producto?") → dice que no
   lo tiene y lo lleva a la reunión, sin inventar.
5. "¿Sos un robot?" → lo dice sin vueltas.
6. "No, gracias, solo estaba viendo" → agradece y corta, sin insistir.

Si en el paso 4 inventa algo, falta cubrir ese caso en `sobre_qlabs` o en el
apartado de "qué NO hacen".
