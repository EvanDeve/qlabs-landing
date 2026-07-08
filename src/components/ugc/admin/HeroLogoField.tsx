"use client";

import { useState } from "react";

export default function HeroLogoField({ currentUrl }: { currentUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        border: "1px dashed var(--line-strong)",
        borderRadius: "var(--r-md)",
        padding: "10px 14px",
        cursor: "pointer",
      }}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Logo"
          style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "var(--b-50, #f5f3ff)",
            display: "grid",
            placeItems: "center",
            color: "var(--b-500, #6d54f3)",
            flexShrink: 0,
          }}
        >
          <i className="fa-regular fa-image" aria-hidden />
        </span>
      )}
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)" }}>Seleccionar archivo</span>
      <input
        type="file"
        name="logo"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setPreview(URL.createObjectURL(file));
        }}
      />
    </label>
  );
}
