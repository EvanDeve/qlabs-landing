"use client";

import { useEffect, useRef, useState, useTransition } from "react";

export default function ConfirmDeleteButton({
  action,
  confirmMessage,
  className,
  style,
  children,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  if (armed) {
    return (
      <button
        type="button"
        disabled={isPending}
        title={confirmMessage}
        onClick={() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          startTransition(() => void action());
        }}
        className={className}
        style={{ ...style, color: "#e5484d" }}
      >
        ¿Seguro? Confirmar
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setArmed(true);
        timeoutRef.current = setTimeout(() => setArmed(false), 8000);
      }}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
