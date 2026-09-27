"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  from: "persona" | "user";
  children: ReactNode;
  /** Draw the iMessage tail (last bubble in a run). */
  tail?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/**
 * iMessage-style bubble. Persona = light grey on the left, user = blue on the right.
 * The tail is a small SVG so it survives any background.
 */
export function Bubble({ from, children, tail = true, size = "md", className = "" }: Props) {
  const mine = from === "user";
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{ originX: mine ? 1 : 0, originY: 1 }}
      className={`flex ${mine ? "justify-end" : "justify-start"} ${className}`}
    >
      <div
        className={[
          "relative max-w-[82%] whitespace-pre-wrap break-words",
          size === "sm" ? "rounded-[16px] px-3 py-1.5 text-[12.5px] leading-[1.35]" : "rounded-[20px] px-4 py-2.5 text-[16px] leading-[1.38]",
          mine ? "imsg-me text-white" : "bg-bubble-gray text-ink",
        ].join(" ")}
      >
        {children}
        {tail ? (
          <svg
            aria-hidden
            viewBox="0 0 12 16"
            className={`absolute bottom-0 h-[14px] w-[10px] ${mine ? "-right-[4px] text-[#0088ff]" : "-left-[4px] -scale-x-100 text-bubble-gray"}`}
          >
            <path fill="currentColor" d="M0 0v10c0 3.3 2.7 6 6 6h6C8 16 4 13 4 8V0H0Z" />
          </svg>
        ) : null}
      </div>
    </motion.div>
  );
}

/** Three bouncing dots — Persona is composing. */
export function TypingBubble({ size = "md" }: { size?: "sm" | "md" }) {
  const dot = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-start"
      role="status"
      aria-label="Persona is typing"
    >
      <div className={`flex items-center gap-1 rounded-[20px] bg-bubble-gray ${size === "sm" ? "px-3 py-2" : "px-4 py-3"}`}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={`${dot} rounded-full bg-faint`}
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
