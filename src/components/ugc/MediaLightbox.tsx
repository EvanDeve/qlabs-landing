"use client";

export type LightboxItem = {
  url: string;
  media_type: "image" | "video";
  caption?: string | null;
};

export default function MediaLightbox({ item, onClose }: { item: LightboxItem | null; onClose: () => void }) {
  if (!item) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 10, 20, 0.88)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          color: "#fff",
          fontSize: "20px",
          fontWeight: 700,
          display: "grid",
          placeItems: "center",
        }}
      >
        ×
      </button>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px", width: "100%" }}>
        {item.media_type === "video" ? (
          <video
            src={item.url}
            controls
            autoPlay
            style={{
              width: "100%",
              maxHeight: "80vh",
              borderRadius: "14px",
              background: "#000",
              display: "block",
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.caption ?? ""}
            style={{ width: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: "14px" }}
          />
        )}
        {item.caption && (
          <p style={{ color: "#fff", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>{item.caption}</p>
        )}
      </div>
    </div>
  );
}
