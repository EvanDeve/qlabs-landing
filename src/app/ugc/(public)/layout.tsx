import UgcScrollMotion from "@/components/ugc/public/UgcScrollMotion";

export default function UgcPublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <UgcScrollMotion />
      {/* Progreso de lectura. z-30 para quedar sobre el nav sticky (z-20). */}
      <div
        className="ugc-progress pointer-events-none fixed left-0 top-0 z-30 h-[3px] w-screen"
        aria-hidden
      >
        <div className="ugc-progress-bar h-full w-full origin-left scale-x-0 bg-gradient-to-r from-violet to-periwinkle" />
      </div>
      {children}
    </div>
  );
}
