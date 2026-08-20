# UGC·CRC — Brief de diseño (rediseño estilo iOS)

> Documento para pasarle a Claude Design. Describe **lo que la plataforma ya hace hoy en producción**,
> con los nombres, estados y números reales. Todo lo que aparece acá existe: no hay features aspiracionales.
> Lo que no está en este documento, **no existe** — no inventes campos, métricas ni pantallas.

---

## 1. Qué es UGC·CRC

Un marketplace costarricense que conecta **negocios** (restaurantes, hoteles, gastrobares) que necesitan
contenido real, con **creadores de contenido verificados a mano** que necesitan ingresos.

Es parte del ecosistema de **Q Labs** (qlabsmethod.com), una agencia de marketing digital en Costa Rica.
La marca se posiciona como *el guía*, no como el héroe: hay **dos héroes** —el negocio y el creador— y la
plataforma es el puente entre ambos. Q Labs verifica a las dos partes a mano, escribe las reglas de la
transacción y responde si algo sale mal.

Referencias de mercado: Cohley y Aspire.io, pero a escala local: más simple, en español (voseo
costarricense: *aplicá, publicá, elegí*), con confianza humana en vez de compliance enterprise.

**El pago no pasa por la app.** Q Labs lo coordina por fuera (escrow humano). La marca paga el 100 % del
presupuesto, la agencia se queda con **20 % de comisión** y el creador recibe el **80 %**. Ese desglose se le
muestra a las dos partes, con las mismas tres cifras: bruto → comisión → neto.

---

## 2. Los dos héroes

### El creador
Persona joven, 8K–25K seguidores, celular en la mano todo el día, en Instagram y TikTok. Su trabajo es
grabar. Entra a la app **para ver si hay promos nuevas, para saber si le respondieron y para no
olvidarse de una entrega**. Casi nunca desde una computadora.

### La marca
Dueño o encargado de marketing de un restaurante/hotel. Entra menos seguido, pero cuando entra tiene una
tarea concreta: **publicar una campaña, revisar quién aplicó, aprobar una entrega**. También usa el
celular en el local (para validar un cupón escaneando un QR en la mesa).

---

## 3. El flujo completo (end-to-end)

```
Marca                                        Creador
─────                                        ───────
1. Se registra → onboarding                  1. Se registra → onboarding
2. ⏳ Q Labs la verifica a mano               2. ⏳ Q Labs lo verifica a mano
   (bloqueo duro: sin verificar no entra)       (bloqueo duro: sin verificar no entra)
3. Publica una campaña                       3. La ve en su Feed de promos
   (brief, ₡, entregables, plazo,               (brief completo, cuánto cobra neto,
    derechos de uso)                             y qué derechos de uso pide la marca)
                                             4. Aplica, con mensaje opcional (pitch)
5. Ve al aplicante + su book + su perfil
6. Acepta / rechaza
                                             7. Graba, sube el archivo o el link
                                                del post publicado
8. Aprueba y califica ★1-5
9. Q Labs coordina el pago por fuera         10. Suma puntos → sube de nivel → 
                                                 desbloquea cupones
```

**Estados de una aplicación** (nombres exactos que se muestran):
`Pendiente` · `En revisión` · `Aceptada` · `Rechazada` · `Entregada` · `Aprobada` · `Cancelada` · `En disputa`

Salidas: el creador puede **cancelar** solo mientras no haya entregado ("Ya no puedo con esta promo").
Después de entregar ya hay trabajo hecho, así que la única salida es **disputar** ("Reportar un problema"),
y ahí Q Labs media y deja una "Resolución de Q Labs" escrita en la tarjeta.

---

## 4. Mapa de pantallas — CREADOR

El menú está agrupado por *qué está haciendo el creador*, no por tipo de pantalla:

| Grupo | Pantalla | Qué es |
|---|---|---|
| **Mi trabajo** | **Resumen** ★ | Home. 4 KPIs + "Requiere tu atención" + estado del pipeline. |
| **Mi trabajo** | **Mi pipeline** ★ | Kanban de producción personal, con columnas que él mismo arma y renombra. Tarjetas con fecha límite. |
| **Herramientas** | **Transcripción** | Sube un audio/video → transcripción → guion mejorado por IA. Espacio de trabajo a pantalla completa. |
| **Marketplace** | **Feed de promos** ★ | Grid de campañas publicadas. Es el corazón de la app. |
| **Marketplace** | **Mis aplicaciones** | Lista de todo a lo que aplicó, con estado, entregables, y el formulario para entregar. |
| **Marketplace** | **Recompensas** | Loyalty Loop: puntos, nivel, cupones de marcas, QR de canje. |
| **Mi cuenta** | **Mi book** ★ | Portfolio de piezas (video/foto). Lo que la marca mira antes de aceptarlo. |
| **Mi cuenta** | **Perfil** | Edición del perfil público: handle, bio, ciudad, nichos, seguidores, redes, habilidades, marcas con las que trabajó. |

★ = las cuatro que hoy salen en la barra inferior de móvil. El resto queda detrás de un botón "Más".

**KPIs del Resumen (etiquetas exactas):** `En producción` · `Esperando respuesta` · `Por cobrar` (en ₡) ·
`Tareas atrasadas`.
**"Requiere tu atención"** son filas accionables: "Entrega vencida hace 2 días", "Se entrega hoy",
"Tu book está vacío". Si no hay nada, la tarjeta **no se rellena con nada inventado**: se encoge y dice
que está todo al día.

**Stats de Mi book:** `Views totales del book` · `Piezas entregadas` · `Rating promedio de marcas` (ej. `4.7★`).

**Tarjeta de promo en el feed** (lo que ve antes de aplicar): logo + nombre de la marca (+ sello verificada),
título, brief, **cuánto cobra neto en ₡**, entregables como chips (`1x Reel`, `3x Stories`), plazo en días,
audiencia objetivo, compensación adicional si hay ("+ Cena para 2 personas incluida"), y los **chips de
derechos de uso**.

---

## 5. Mapa de pantallas — MARCA

| Grupo | Pantalla | Qué es |
|---|---|---|
| **Centro de Mando** | **Resumen** | Home. 3 KPIs + tarjetas de "Mis sistemas" de Q Labs. |
| **Marketing** | **UGC·CRC** | El panel del marketplace. Dos pestañas: `Mis campañas` / `Aplicantes (n)`. Badge con pendientes. |
| **Marketing** | **Loyalty Loop** | Cupones para creadores, canjes, validación. |
| **Cuenta** | **Perfil del negocio** | Nombre, rubro, zona, web, logo, descripción. |
| *(sin menú)* | **Nueva campaña** | Formulario. |
| *(sin menú)* | **Detalle de campaña** | Brief + lista de aplicantes + entregas + aprobar/calificar. |
| *(sin menú)* | **Validar canje** | A donde lleva el QR del creador. Se abre en el celular de quien atiende. |

Las cuatro del menú caben enteras en la barra inferior de móvil.

**KPIs del Resumen:** `Campañas activas` · `Aplicantes por revisar` · `Aplicantes nuevos (7 días)`.

**"Mis sistemas"** son tarjetas: dos con pill verde `Activo` (**UGC·CRC** y **Loyalty Loop**, con botón
"Abrir panel") y cuatro apagadas con pill gris `Conocé más`, que son los otros servicios de la agencia:
*La Operación*, *La Vitrina*, *IA & Automatización*, *Crecimiento & Estrategia*.

**Formulario de nueva campaña (campos exactos):**
Título · Brief · Presupuesto (₡) · Plazo (días) · Audiencia objetivo · Compensación adicional (opcional) ·
Entregables (elegí al menos uno, con cantidad: **Reel, Stories, TikTok, Fotos**) · **Derechos de uso**
(alcance + duración + si se puede editar + aclaraciones). Se guarda como **borrador** o se **publica**.

**Derechos de uso** — es el bloque de confianza del producto, y las tres superficies (formulario, detalle
de campaña, detalle de promo del creador) dicen exactamente lo mismo:
- Alcance: `Solo redes de la marca` / `Orgánico + pauta` / `Cualquier medio`
- Duración: `3 meses` / `6 meses` / `12 meses` / `Siempre`
- Edición: `Editable` / `Sin editar`

---

## 6. Loyalty Loop (el sistema de fidelidad)

Es el módulo con más potencial visual y hoy es el más plano.

**Lado creador — "Recompensas":**
- **Puntos y nivel.** Escalera real: `Bronce` (0 pts) → `Plata 🥈` (500) → `Oro 🥇` (1500) → `Platino 💎` (4000).
  Colores por nivel: Bronce `#a06a3c`, Plata `#7d8794`, Oro `#c07414`, Platino `#6d54f3`.
  La barra de progreso mide **dentro del tramo actual**, no sobre el total.
- **Cómo se ganan puntos** (reglas reales): Perfil completado al 100 % `+50` (una sola vez) · Pieza subida
  al book `+10` (tope 5/mes) · Aplicación a promo `+5` (tope 10/mes) · Seleccionado en campaña `+50` ·
  **Entrega aprobada `+150`** · Rating 5★ `+50` · Rating 4★ `+20`.
- **Feed de cupones** de las marcas. Tipos: `Producto`, `Servicio`, `Evento`. Cada cupón tiene nivel mínimo,
  stock disponible, vigencia y condiciones. El feed ordena: **primero lo que puede reclamar hoy**, después
  lo que ya reclamó, después lo bloqueado por nivel (que es el motivo para seguir entregando), y al fondo
  lo agotado. Un cupón bloqueado no dice "requiere Oro": dice **cuántos puntos le faltan**.
- **Mis cupones**: los que reclamó, cada uno con su **código y su QR**, y estado `Por usar` / `Canjeado` /
  `Vencido` + cuántos días le quedan.
- **Historial de puntos**: ledger con la acción y a qué campaña corresponde ("el reel de Zonna", no un uuid).

**Lado marca — "Loyalty Loop":** KPIs `Cupones activos` · `Reclamos totales` · `Canjes confirmados`;
crear/pausar cupones; tabla de canjes; y **Validar canje**, que es la pantalla que se abre al escanear el
QR del creador en el local.

---

## 7. Lo público (fuera de sesión)

- **`/ugc`** — landing del marketplace: hero, "Cómo funciona" con un toggle **creador / marca** (4 pasos
  cada uno), aviso de acceso anticipado, FAQ, CTA final.
- **`/ugc/login`** — una sola puerta, con `?intent=marca|creador`.
- **Onboarding** — form corto por rol.
- **Pantalla "pendiente"** — la sala de espera de la verificación manual. Explica los 3 pasos y deja
  corregir los datos mientras espera. Es una pantalla que mucha gente ve **varios días**.
- **Perfil público del creador** `/ugc/creadores/[handle]` — portada degradada violeta, avatar circular,
  sello "Creador verificado", ciudad, seguidores, bio, chips de nichos, links a IG/TikTok, 3 stats,
  book en grid, habilidades, marcas con las que trabajó.
- **Perfil público de la marca** `/ugc/marcas/[slug]`.

**Notificaciones** (campana, in-app + email): nueva aplicación · cambio de estado · entrega recibida ·
disputa · verificación pendiente · verificación aprobada · **subiste de nivel** · cupón por vencer ·
cupón canjeado · alguien tocó una pieza de tu book.

---

## 8. Cómo se ve hoy (y qué conservar)

El sistema visual se llama **Q·OS** y es un shell de dashboard clásico: sidebar colapsable a la izquierda,
topbar con breadcrumb + campana + avatar, contenido en tarjetas blancas. En móvil (< 900 px) la sidebar se
esconde y aparece una barra inferior de 4 ítems + "Más".

**Tokens de marca (respetarlos — vienen de la landing real en producción):**

| Token | Valor | Uso |
|---|---|---|
| `ink` | `#0A0B10` | Texto principal |
| `ink-soft` | `#5B5570` | Texto secundario |
| `violet` | `#705CF6` | **Color de acento / tint principal** |
| `violet-deep` | `#5641D8` | Hover / gradientes |
| `periwinkle` | `#8E80F2` | Gradientes |
| `lavender` | `#F6F4FD` | Fondos suaves |
| `lavender-deep` | `#ECE7FB` | Fondos suaves 2 |
| `trust` | `#17A673` | Verde de confianza (verificado, aprobado) |
| `trust-bg` | `#E7F7F1` | Fondo del verde |
| `coral` | `#FF6B57` | Alertas / urgencia |
| línea | `rgba(10,11,16,0.10)` | Bordes hairline |

Colores de KPI que ya se usan: violeta `#6d54f3`, ámbar `#c07414`, verde `#14a06a`, rojo `#df4650`.

**Tipografía:** `Plus Jakarta Sans` — 800 para headings, 400-700 para body. Es la fuente de toda la app.
**Radios:** 14 px en tarjetas, 999 px (pill) en botones y chips.
**Moneda:** siempre colones con formato `es-CR` → `₡150,000`.
**Idioma:** todo en español de Costa Rica, voseo. Nunca inglés en la UI.

**Lo que hay que dejar atrás:** el look "dashboard genérico" — exceso de bordes, densidad de tabla, pills
de eyebrow en mayúsculas, Space Mono por todos lados. Y ojo: una exploración anterior en lavanda + Space
Mono + eyebrows fue rechazada por verse "hecha por IA". No volver ahí.

---

## 9. EL ENCARGO: rediseñarlo con lenguaje iPhone

La plataforma se usa **desde el celular**, pero está diseñada como un panel de escritorio encogido. El
encargo es rediseñarla como se diseñaría una **app nativa de iOS**, manteniendo la identidad de Q Labs
(violeta, Plus Jakarta Sans, calidez, español tico). No queremos "iOS genérico gris": queremos **una app de
iPhone que claramente es de esta marca**.

### 9.1 Qué significa concretamente

**Estructura**
- **Tab bar inferior** con material translúcido (blur) y safe area, no una sidebar encogida. 4 ítems + Más
  para el creador; 4 ítems justos para la marca. Ícono + label corto, tint violeta en el activo.
- **Large title** que colapsa a título inline al hacer scroll. Nav bar con chevron `‹ Atrás` a la izquierda.
- **Sheets modales** con grabber y *detents* (media pantalla / pantalla completa) para: detalle de una promo,
  aplicar a una promo, crear una tarjeta del pipeline, filtros. Nada de páginas nuevas para acciones cortas.
- **Listas inset-grouped** (tarjetas agrupadas con separadores hairline con inset) para todo lo que hoy es
  formulario o tabla: Perfil, Perfil del negocio, historial de puntos, tabla de canjes.
- **Swipe actions** en las filas: aceptar/rechazar un aplicante deslizando; archivar una notificación.
- **Segmented control** donde hoy hay pestañas: `Mis campañas / Aplicantes`, `creador / marca`,
  `Cupones / Mis cupones / Historial`.
- **Pull-to-refresh** en Feed de promos y Mis aplicaciones.

**Materiales y forma**
- Esquinas **continuas (squircle)**, 16–22 px en tarjetas, no 14 px de esquina circular.
- Fondos en capas al estilo iOS: fondo agrupado (lavanda muy suave) + tarjetas blancas elevadas, sombras
  casi imperceptibles en vez de bordes de 1 px por todos lados.
- Blur/vibrancy en barras y headers pegados.
- Targets táctiles de **44 pt mínimo**. Botón primario ancho completo, 50 px de alto, pill o 14 px.

**Tipografía**
- Mantener **Plus Jakarta Sans**, pero mapeada a la **escala de iOS**: Large Title 34/41, Title1 28,
  Title2 22, Title3 20, Headline 17 semibold, Body 17, Callout 16, Subhead 15, Footnote 13, Caption 12/11.
  Hoy los tamaños son de web (26 px, 13.5 px) y en un celular se leen apretados.

**Color**
- Definir **tokens semánticos** al estilo iOS mapeados sobre la paleta de Q Labs: `label`, `secondaryLabel`,
  `tertiaryLabel`, `separator`, `systemBackground`, `groupedBackground`, `fill`. Tint global = `violet #705CF6`.
- **Dark mode completo.** Hoy no existe y en una app de celular que se usa de noche, hace falta.

**Movimiento**
- Transiciones push/pop, sheets que suben, springs. Nada de fades de página web.
- Sugerir dónde hay **haptics**: aplicar a una promo, reclamar un cupón, validar un canje.

**Iconografía**
- Estilo **SF Symbols**: trazo redondeado, grosor consistente con el texto. Hoy hay dos familias mezcladas
  (íconos propios en el panel, Font Awesome en lo público) — unificar.

### 9.2 Traducciones concretas que quiero ver

| Pantalla actual | Patrón iOS que le corresponde |
|---|---|
| Sidebar Q·OS | Tab bar inferior con blur |
| Fila de KPIs del Resumen | Tarjetas tipo **widget** (grid 2×2), con jerarquía real: el número manda |
| "Requiere tu atención" | Lista de acciones con swipe, tipo Recordatorios |
| Kanban del pipeline | Columnas **paginadas horizontalmente** con page dots, drag largo + haptic |
| Feed de promos | Feed de tarjetas grandes con imagen → **sheet de detalle** → botón "Aplicar" fijo abajo |
| Mis aplicaciones | Lista agrupada por estado, con **badges de estado** y timeline de progreso |
| Mis cupones (Recompensas) | **Apple Wallet**: tarjetas apiladas, se despliegan al tocar, QR a pantalla completa con brillo al máximo |
| Nivel y puntos | Anillo de progreso tipo Activity + celebración al subir de nivel |
| Mi book | Grid tipo app Fotos, visor a pantalla completa con gestos |
| Validar canje | **Escáner de cámara a pantalla completa** con confirmación grande verde/roja |
| Formulario de campaña | Form agrupado en pasos, con pickers e inputs nativos, no un `<form>` largo |
| Pantalla "pendiente" | Estado de espera cálido y explicado, no un error |

### 9.3 Entregable que quiero de vos

Mockups de **alta fidelidad a 393 × 852 pt (iPhone 16 / 15 Pro)**, con safe areas dibujadas, en **light y
dark**, priorizando en este orden:

1. **Creador — Feed de promos** (lista + sheet de detalle de una promo con derechos de uso)
2. **Creador — Resumen** (widgets + atención)
3. **Creador — Recompensas** (nivel + cupones estilo Wallet + QR a pantalla completa)
4. **Marca — UGC·CRC** (campañas + aplicantes con swipe actions)
5. **Marca — Nueva campaña** (form agrupado)
6. **Creador — Mis aplicaciones** (estados + entregar)
7. **Marca — Validar canje** (escáner)
8. **Tab bars** de los dos roles + **dark mode** de al menos las tres primeras

Y una **hoja de estilo**: escala tipográfica, tokens de color en light/dark, radios, sombras, alturas de
componente, y los componentes base (botón, chip de estado, tarjeta, fila de lista, sheet, tab bar).

---

## 10. Reglas duras (no las rompas)

1. **No inventes campos ni métricas.** Si un dato no está en este documento, no existe en la base y el
   mockup no lo puede mostrar. Nada de "engagement rate promedio 4.2 %" o "ganancias del mes" si no
   figuran acá.
2. **Todo en español de Costa Rica, con voseo.** *Aplicá, publicá, elegí, contá, subí*. Cero inglés en la UI.
3. **Moneda en colones**, formato `₡150,000`.
4. **La verificación es manual y es un bloqueo duro.** No la dibujes como un check automático: el sello
   significa que una persona lo revisó, y ese es el argumento de venta.
5. **El pago no ocurre en la app.** No dibujes billeteras, saldos retirables ni botones de "Cobrar".
   "Por cobrar" es un monto informativo que Q Labs coordina por fuera.
6. **Está fuera de alcance** (no lo diseñes): pagos in-app, mensajería creador↔marca, Academia/cursos,
   feed social, suscripción Marca Pro, blog.
7. **Los dos lados ven las mismas cifras.** El desglose bruto/comisión/neto se muestra igual a la marca y
   al creador. No hay número escondido.
