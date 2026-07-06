"use client";

import { signOutAction } from "@/lib/actions/auth";

export default function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-pill border border-black/10 px-5 py-2 text-sm font-bold text-ink transition hover:border-ink"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
