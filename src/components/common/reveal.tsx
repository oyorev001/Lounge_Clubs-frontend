import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Scroll-reveal wrapper — starts hidden, plays `animate-fade-up` the first
 * time it enters the viewport, then stays. Used for below-the-fold landing
 * sections so the page doesn't feel static. Global prefers-reduced-motion
 * CSS already flattens this for users who ask for it.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
      className={cn(shown ? "animate-fade-up" : "reveal-hidden", className)}
    >
      {children}
    </div>
  );
}
