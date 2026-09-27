"use client";

import { MotionConfig } from "framer-motion";

/** Respect the OS "reduce motion" setting across every Framer Motion animation. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
