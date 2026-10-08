# 002 · Media kit del creador

**Estado:** aprobada por Evan el 2026-10-08 · T01–T17 en prod el mismo día; T18 (orden visual) espera los mockups.

## Contexto y por qué

Evan revisó CreatorsJet, una plataforma donde el creador arma un media kit público con sus números y sus mejores publicaciones, lo comparte en la bio y recibe contactos de marcas. La pregunta fue qué de eso traer a UGC·CRC.

La página pública del creador **ya funciona como media kit**: se comparte con un link, tiene la vista previa armada para WhatsApp e Instagram, y muestra la identidad, los seguidores, los trabajos entregados, el rating, el anillo de confianza, el book, las habilidades y las marcas que el creador declara. Le faltan tres cosas que sí tiene CreatorsJet:

1. **Destacar lo mejor.** Hoy el book sale entero y en orden, y no hay forma de decir "estas son mis mejores piezas".
2. **Que una marca lo pueda contactar.** Hoy el único llamado es genérico ("publicá una campaña"). Evan decidió que haya contacto directo, pero solo para marcas verificadas, para que el teléfono del creador no quede expuesto en internet.
3. **Saber si alguien lo mira.** El creador comparte el link y no tiene idea de si sirvió.

El orden y el diseño visual de la página los define Evan con sus mockups. Esta spec dice QUÉ tiene que haber, no dónde va cada cosa.

## Alcance

**Dentro:**
- Piezas destacadas: el creador elige hasta 3 piezas de su book que se muestran destacadas en su kit.
- Contacto directo: el creador elige si muestra su número de teléfono; solo lo ven marcas verificadas con sesión iniciada, y el creador se entera cuando una marca lo mira.
- Visitas del kit: el creador ve en su pantalla de inicio cuántas veces se abrió su kit en los últimos 30 días y cuántas de esas visitas fueron de marcas.
- El reordenamiento de la página según los mockups que mande Evan.

**Fuera:**
- Propuestas privadas o invitaciones a campañas desde el kit (Evan las descartó).
- Números por red, interacción y vistas promedio (las columnas se borraron en la spec 001 y Evan no las pidió).
- Trayectoria verificada (marcas con las que trabajó dentro de UGC·CRC).
- CRM de tratos, calculadora de tarifas, base de contactos de marcas, link en la bio, links cortos, dominio propio, planes de pago.
- Conexión automática con Instagram o TikTok.
- Analítica detallada de visitas (países, dispositivos, de dónde llegan).

## Requisitos funcionales

### Piezas destacadas
- **RF-01** — EL SISTEMA le permite al creador marcar como destacadas hasta 3 piezas de su propio book, y elegir en qué orden salen.
- **RF-02** — SI el creador intenta destacar una cuarta pieza, ENTONCES EL SISTEMA no la destaca y le avisa que el máximo es 3.
- **RF-03** — MIENTRAS el creador tenga piezas destacadas, EL SISTEMA las muestra en su kit en un bloque propio, separadas del resto del book.
- **RF-04** — SI el creador no tiene ninguna pieza destacada, ENTONCES EL SISTEMA no muestra el bloque de destacadas (no elige piezas por su cuenta).
- **RF-05** — CUANDO el creador borra del book una pieza destacada, EL SISTEMA la saca también de las destacadas.

### Contacto directo
- **RF-06** — EL SISTEMA le permite al creador cargar un número de teléfono y elegir si lo muestra en su kit. Por defecto no se muestra. El contacto es solo el teléfono: no se muestra ningún correo.
- **RF-07** — CUANDO el creador carga su número, EL SISTEMA lo valida como número de teléfono (con código de país, +506 por defecto) antes de guardarlo.
- **RF-08** — MIENTRAS quien mira el kit sea una marca verificada con sesión iniciada, EL SISTEMA le ofrece "Ver teléfono"; CUANDO la marca lo toca, EL SISTEMA le muestra el número con la opción de abrir WhatsApp o llamar con un toque.
- **RF-09** — SI quien mira el kit no tiene sesión, o tiene sesión pero no es una marca verificada, y el creador eligió mostrar su teléfono, ENTONCES EL SISTEMA muestra que hay contacto disponible y explica que lo ven las marcas verificadas, con un camino para iniciar sesión o registrarse como marca.
- **RF-10** — EL SISTEMA nunca entrega el teléfono del creador a quien no sea una marca verificada o alguien del equipo de Q Labs, ni en la página ni consultando los datos por fuera de ella.
- **RF-11** — CUANDO el creador mira su propio kit, EL SISTEMA le muestra su teléfono con la aclaración de que solo lo ven las marcas verificadas.
- **RF-12** — SI el creador no eligió mostrar su teléfono, ENTONCES EL SISTEMA no muestra nada sobre contacto directo en su kit.
- **RF-12b** — CUANDO una marca toca "Ver teléfono" en el kit de un creador, EL SISTEMA le avisa al creador con una notificación en su campanita que dice qué marca vio su número.
- **RF-12c** — SI la misma marca vuelve a tocar "Ver teléfono" en el kit del mismo creador ese mismo día, ENTONCES EL SISTEMA no le manda otra notificación al creador.

### Visitas del kit
- **RF-13** — CUANDO alguien abre el kit de un creador, EL SISTEMA registra la visita, sin guardar datos personales de quien visita si no tiene sesión.
- **RF-14** — EL SISTEMA no cuenta como visita cuando el creador mira su propio kit, ni cuando lo mira alguien del equipo de Q Labs.
- **RF-15** — EL SISTEMA no cuenta como visita la lectura automática que hacen las apps (WhatsApp, Instagram, buscadores) para armar la vista previa del link.
- **RF-16** — EL SISTEMA cuenta como una sola visita las aperturas repetidas de la misma persona dentro de un mismo día.
- **RF-17** — EL SISTEMA le muestra al creador, en su pantalla de inicio, la cantidad de visitas de los últimos 30 días y cuántas fueron de marcas con cuenta.
- **RF-18** — SI el kit no tuvo visitas en los últimos 30 días, ENTONCES EL SISTEMA se lo dice al creador en un tono que lo invite a compartir el link, con el botón para copiarlo.
- **RF-19** — EL SISTEMA no le muestra a nadie más que al creador (y al equipo de Q Labs) las visitas de su kit.

### General
- **RF-20** — EL SISTEMA mantiene funcionando los links de kits que ya se compartieron.
- **RF-21** — SI el creador no está verificado, ENTONCES EL SISTEMA sigue sin mostrar su kit al público, como hoy.

## Casos límite

- **Una marca verificada que pierde la verificación** deja de ver los teléfonos desde ese momento.
- **Un creador que borra u oculta su teléfono** después de que una marca lo vio: la marca ya lo tiene anotado, y eso es inevitable. El texto de la opción tiene que dejar claro que lo que se muestra se puede copiar.
- **Una pieza destacada que es un video que no carga** (se borró el archivo): no puede romper el bloque de destacadas.
- **Bots que no se identifican como vista previa de un link:** pueden inflar las visitas. Se acepta un margen de error; el número es orientativo, no una facturación.
- **Una marca que mira el kit muchas veces en distintos días** cuenta una visita por día.
- **El handle guardado con y sin "@"**: los links viejos de las dos formas siguen abriendo el mismo kit, como hoy.
- **Zona horaria:** el "mismo día" y los "últimos 30 días" se cuentan en hora de Costa Rica.

## Decisiones de Evan (2026-10-08)

1. El contacto es **solo el número de teléfono** (sin correo).
2. Las visitas se ven en la **pantalla de inicio** del creador.
3. El creador **se entera** cuando una marca ve su teléfono (RF-12b/c).
4. Una "visita de marca" es la de cualquier cuenta de marca con sesión, esté verificada o no; el teléfono, en cambio, solo lo ven las verificadas.
5. El orden visual de la página lo define Evan con mockups: es la última tarea y espera sus capturas.
