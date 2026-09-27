"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Each step's main heading. Receives focus when the step mounts so keyboard
 * and screen-reader users land at the top of the new screen.
 */
export function StepHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={`outline-none ${className}`}>
      {children}
    </h1>
  );
}
