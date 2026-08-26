# Auditoría de seguridad — 2026-08-26

Corrida contra **producción** (no hay staging). Todo lo que dice "probado" se
reprodujo con cuentas desechables `rlstest.auditoria.*` que se borraron al
terminar. `origin/main` = `1b379f7`.

## La causa común de casi todo

**Las vistas filtran; las tablas que hay debajo, no.**

El proyecto protege los datos públicos con vistas (`creator_public_profiles`,
`campaign_previews`, `staff_directory`, `coupon_stock`) y esas vistas están
bien hechas: filtran por creador aprobado, esconden presupuesto, esconden
teléfonos. Pero en tres lugares la tabla cruda quedó abierta al mismo público,
así que la vista se puede saltear pidiendo la tabla directo. Los hallazgos 1,
2, 4 y 5 son todos la misma historia.

---

## 🔴 1. `brand_profiles` — la tabla entera es de lectura anónima

**Probado.** La policy es de la primera migración
(`20260706193348_profiles_and_roles.sql:155`) y nunca se reemplazó:

```sql
create policy "brand_profiles_select_public"
  on public.brand_profiles for select
  to anon, authenticated
  using (true);          -- ← sin filtro
```

`using (true)` significa **todas las filas y todas las columnas**, para
cualquiera con la anon key — que viaja en el HTML de cada página del sitio.

Se creó una marca desechable, se la marcó rechazada con un motivo interno y se
la pidió con la anon key:

```
LO QUE VE UN ANÓNIMO:
[{"brand_name": "Negocio Auditoria QA", "verified": false,
  "rejected_at": "2026-08-26T00:00:00+00:00",
  "rejection_reason": "MOTIVO INTERNO: sospechamos que el local no existe"}]
```

Queda expuesto: qué negocios se registraron pero **no** están verificados, cuáles
fueron **rechazados**, y **por qué** — con el texto que escribió el equipo
pensando que era interno.

Hoy no hay ninguna marca con `rejection_reason` cargado, así que no se está
filtrando nada todavía. Se filtra el día que alguien rechace la primera.

**Arreglo:** el mismo patrón que ya usa el creador. Cerrar la tabla y exponer
una vista `brand_public_profiles` con las columnas de vitrina
(`brand_name, industry, website, instagram_handle, description, logo_url,
location, slug, verified`) filtrando `verified = true`. Las páginas que hoy
hacen `select('*')` sobre la tabla pasan a la vista.

---

## 🔴 2. El book de un creador no publicado se descarga sin ninguna llave

**Probado.** Encadena dos cosas:

1. `portfolio_items` tiene, desde `20260724500000_creator_public_profile_anon.sql:41`:
   `on public.portfolio_items for select to anon using (true)` — sin filtro por
   creador publicado, al contrario de la vista.
2. El bucket `portfolio` es **público**.

Entonces:

```
storage_path leído SIN sesión: 4b18e3d4-…/835074d0-….mp4
descarga pública (sin ninguna llave): HTTP 200 · 3 659 686 bytes · video/mp4
```

Y con un creador desechable sin verificar:

```
creator_public_profiles  -> 0 filas   ← la vista lo oculta bien
portfolio_items          -> 1 fila    ← pero la tabla lo entrega
```

O sea: alguien que se registró, subió su book y todavía está esperando
verificación —o fue rechazado— tiene sus piezas descargables por cualquiera.

**Arreglo:** que la policy `anon` de `portfolio_items` exija que el dueño esté
en `creator_public_profiles`, en vez de `using (true)`.

---

## 🔴 3. Los endpoints de transcripción no miran la verificación

**Probado.** `requireRole()` trae el gate de verificación y por él pasan los
tres layouts. Los route handlers **no lo llaman**: chequean `profiles.role` a
mano y nada más. Y `/api/*` no está en el matcher del proxy
(`matcher: ["/ugc/:path*", "/admin/:path*"]`), así que tampoco lo tapa el
middleware.

Con una cuenta que **ni siquiera completó el onboarding** (`verified = sin fila`):

```
GET  /ugc/creador                    307 -> /ugc/onboarding     ← la página frena
GET  /ugc/creador/transcripcion      307 -> /ugc/onboarding     ← la página frena
GET  /api/ugc/transcribe/historial   200 []                     ← la API no
POST /api/ugc/transcribe             400 "Pegá un link o subí un archivo."
POST /api/ugc/transcribe/guion       400 "Falta la transcripción."
```

Los dos POST contestan **400 de validación y no 403**: pasaron el control de
acceso y fallaron más adelante, por el cuerpo vacío que se mandó a propósito
para no gastar cuota. Con un cuerpo válido corren.

El rol lo elige la persona al registrarse, así que la barrera real es cero.
No hay fuga de datos —`historial` filtra por `creator_id`— pero sí consumo:
cuota de Gemini y subida de video al bucket `transcription-uploads`, desde una
cuenta ficticia.

Es la misma clase de hueco que se cerró el 2026-08-07 en RLS y en
`claim_coupon`, reaparecida en la capa de handlers.

**Arreglo:** que los tres handlers usen el mismo gate que los layouts. Como
`requireRole` hace `redirect()` y eso no sirve en una API, conviene extraer el
chequeo a una función que devuelva el estado y que cada capa decida qué hacer
con él.

---

## 🟠 4. `creator_skills` y `creator_past_brands`, lo mismo que el book

**Probado.** Misma migración, mismas dos policies `to anon using (true)`:

```
creator_skills       -> 1 fila  [{'name': 'SECRETO-AUDITORIA'}]
creator_past_brands  -> 1 fila  [{'brand_name': 'MARCA-SECRETA-AUDITORIA'}]
```

de un creador que la vista pública oculta correctamente. Menos grave que el
book porque es texto y no archivos, pero es la misma policy y se arregla igual.

---

## 🟠 5. `creator_profiles`: cualquier sesión lee lo que la vista esconde

**Probado.** La tabla es legible por cualquier usuario autenticado. Comparando
columnas contra la vista:

```
columnas de la TABLA que la vista deliberadamente NO expone:
  ['avg_reach', 'rate_max', 'rate_min', 'rejected_at', 'rejection_reason']
```

`rate_min` / `rate_max` son la **tarifa** del creador. Que un creador lea las
de todos sus colegas, o que una marca lea el piso antes de negociar, rompe
justamente lo que un marketplace vende. Y `rejection_reason` es la nota interna
de Q Labs.

Hoy los cinco campos están en `null` en las 7 filas, así que no se filtra nada
—pero se filtra el día que se empiecen a usar, sin que nadie toque una línea.

**Arreglo:** acotar la policy de SELECT para terceros a las columnas de
vitrina, o dejar la tabla solo para el dueño y el admin y que el resto de la
app lea la vista.

---

## 🟡 6. Cinco buckets públicos sin tope de tamaño ni lista de tipos

| bucket | público | tope | tipos |
|---|---|---|---|
| `avatars`, `brand-logos`, `hero-logos`, `coupon-images`, `campaign-covers` | sí | **ninguno** | **cualquiera** |
| `transcription-uploads` | no | 20 MB | solo video |
| `deliveries` | no | 50 MB | — |
| `portfolio` | sí | 25 MB | — |
| `voiceovers` | no | 10 MB | solo audio |

Las policies de escritura sí están bien: `(storage.foldername(name))[1] =
auth.uid()::text`, cada quien en su carpeta. Pero sin tope ni tipo, una cuenta
verificada puede subir cualquier archivo, de cualquier tamaño, a una URL
pública del proyecto. **El primer límite de escala del proyecto es el 1 GB de
Storage**, así que esto es plata además de higiene.

---

## 🟡 7. Sin freno propio en login ni registro

`requestPasswordResetAction` tiene su tabla `password_reset_throttle`. `signIn`
y `signUp` no tienen ninguno en el código de la app: dependen del rate limit
que trae la plataforma de Supabase. No es "sin protección", pero es la única
capa y no la controlamos nosotros.

---

## 🟡 8. Los tokens de los links públicos no caducan

`/cronograma/<share_token>` y `/grabacion/<crew_token>` son uuid v4 — 122 bits,
imposible de adivinar. Pero **no vencen y no se pueden rotar** desde la
interfaz. Un link reenviado por WhatsApp sirve para siempre. Para el cronograma
del mes pasado eso es casi inofensivo; conviene tener presente que el de
grabación muestra apuntes internos.

---

## ✅ Lo que se probó y está bien

Vale decirlo con el mismo detalle, porque es la mayor parte:

- **Q·OS no se filtra.** Con sesión de creador y de marca, las 13 tablas del
  equipo —`staff_members`, `wa_messages`, `wa_public_messages`,
  `wa_agent_actions`, `agent_settings`, `agency_clients`, `content_pieces`,
  `content_columns`, `calendar_events`, `calendar_month_items`,
  `hero_calendar_months`, `voiceovers`, `password_reset_throttle`— devuelven
  **cero filas**.
- **Cada quien ve lo suyo:** notificaciones (2 de 200 · 17 de 200),
  transcripciones (4 de 14), columnas del pipeline propio (5 de 20),
  aplicaciones (2 de 8 · 3 de 8).
- **Sin sesión no sale nada interno:** de 38 relaciones, las únicas que
  devuelven filas al anónimo son las públicas por diseño más las cuatro de los
  hallazgos. `coupon_stock` y `staff_directory` contestan 401.
- **Los 7 route handlers tienen chequeo propio**, aunque el proxy no los cubra:
  el cron con `CRON_SECRET`, el webhook con firma de Twilio, los de voz con rol
  admin. El agujero del hallazgo 3 es de *verificación*, no de autenticación.
- **Service-role siempre detrás de un chequeo explícito.** Los tres usos que
  crean o borran cuentas y disparan WhatsApp pasan por `soyDirector()`, que lee
  de la base y no de un claim del JWT.
- **Sin escalada por `staff_members`:** un no-director no tiene policy de
  UPDATE; la de la fila propia es solo SELECT.
- **Las acciones públicas del cronograma** resuelven el token a un cronograma
  antes de tocar nada y acotan cada escritura a `(hero_id, month)`: un id de
  video de otro Hero no sirve. Comentario tope 2000 caracteres.
- **Nada secreto en el bundle:** solo `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SITE_URL`. Ningún componente
  de cliente lee `process.env`.

## Orden sugerido para arreglar

1. **3** — es el único que se explota sin saber nada del sistema y cuesta plata.
2. **1 y 2** — los dos exponen datos de gente que confió en que estaban privados.
3. **4 y 5** — misma familia, se arreglan con la misma pasada.
4. **6, 7, 8** — higiene, cuando haya rato.

## Efecto lateral encontrado, que no es de seguridad

`saveWhatsAppSettingsAction` escribe en `staff_members` con el cliente de
sesión, pero un **no-director no tiene policy de UPDATE**: la escritura no
afecta ninguna fila y PostgREST igual contesta 204. O sea que un guionista
guarda su teléfono, ve "Guardado", y no se guardó nada. Sin confirmar contra
la base todavía.
