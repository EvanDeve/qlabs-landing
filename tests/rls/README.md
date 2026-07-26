# Tests de RLS y del flujo crítico

Cubren lo que el roadmap pide como mínimo: que **un usuario no pueda leer datos ajenos** y que el **flujo publicar → aplicar → aceptar** funcione de punta a punta.

```bash
npm test       # unitarios: rápidos, sin base de datos. Estos corren siempre.
npm run test:rls   # estos. Hablan con Supabase.
```

## ⚠️ Estos tests escriben en el proyecto Supabase real

Hoy hay **un solo proyecto de Supabase, y es también producción** (`www.qlabsmethod.com/ugc` sirve desde ahí). No existe entorno de staging, así que estos tests no tienen dónde correr aislados.

Lo que hacen para que eso no sea un problema:

- Crean **cuentas desechables** con email único (`rlstest.<rol>.<uuid>@testmail.cr`), nunca reutilizan las de QA.
- Borran todo en el `afterAll`. Alcanza con borrar el usuario de `auth.users`: `profiles.id` lo referencia con `on delete cascade` y el resto del marketplace cuelga de `profiles`.
- Si algún borrado falla, `cleanup()` **tira error a propósito** — es preferible un test rojo a cuentas huérfanas acumulándose en producción.
- Corren en serie (`fileParallelism: false`): crean y borran datos, en paralelo se pisarían.

Después de correrlos conviene confirmar que no quedó nada:

```bash
set -a && . ./.env.local && set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users?per_page=200" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  | python3 -c "import sys,json;print([u['email'] for u in json.load(sys.stdin)['users'] if 'rlstest' in (u.get('email') or '')])"
```

**La salida correcta es una lista vacía.**

## Lo mejor sería no correrlos contra producción

La solución de fondo es levantar Supabase local (`supabase start`, requiere Docker) o crear un segundo proyecto de Supabase para desarrollo. La CLI ya está instalada (2.109.0) y `supabase/config.toml` existe; lo único que faltó el día que se escribieron estos tests fue Docker corriendo. Si eso se resuelve, apuntar `.env.local` al stack local y estos mismos tests corren sin tocar nada real.

## Por qué se comprueba el efecto y no solo el error

Varios tests hacen el `update` prohibido y después releen la fila con service role, en vez de solo mirar si vino `error`. Es a propósito: RLS puede rechazar explícitamente **o** simplemente no afectar ninguna fila, y en el segundo caso `error` viene `null`. Lo que importa es que el dato no cambió.

## Cuidado al escribir tests nuevos

Un `insert` de setup que falla en silencio deja los tests "pasando" contra un escenario que no existe — pasó al escribir estos (`creator_profiles` no tiene columna `city`, vive en `profiles`; y la columna del mensaje es `pitch_message`, no `message`). Por eso el `beforeAll` chequea cada error y tira.
