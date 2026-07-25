// `creator_profiles.handle` se guarda con "@" adelante por convención, pero hay
// filas históricas sin él. La query pública ya tolera ambos formatos; estos dos
// helpers hacen que el render y las URLs también lo hagan, en vez de repetir
// `.replace(/^@/, "")` suelto por todo el código.

/** Para URLs: /ugc/creadores/[handle] — sin "@" (App Router reserva ese prefijo). */
export function handleSlug(handle: string) {
  return handle.trim().replace(/^@+/, "");
}

/** Para mostrar en pantalla: siempre con un único "@". */
export function displayHandle(handle: string) {
  const bare = handleSlug(handle);
  return bare ? `@${bare}` : "";
}
