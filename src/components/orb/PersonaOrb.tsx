"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { PersonaMark } from "@/components/brand/PersonaLogo";
import type { LevelSource } from "@/lib/voice/level";

export type OrbState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "ended";

type Props = {
  state?: OrbState;
  level?: LevelSource;
  size?: number;
  className?: string;
};

/**
 * Persona's orb: a black glass sphere with the white Persona mark.
 * - idle: slow breathing glow
 * - listening / speaking: scale + glow follow the live audio level
 * - thinking / connecting: a slow rotating sheen
 */
export function PersonaOrb({ state = "idle", level, size = 160, className = "" }: Props) {
  const reduce = useReducedMotion();
  const raw = useMotionValue(0);
  const smooth = useSpring(raw, { stiffness: 260, damping: 22, mass: 0.6 });
  const scale = useTransform(smooth, [0, 1], [1, 1.09]);
  const glowScale = useTransform(smooth, [0, 1], [1, 1.35]);
  const glowOpacity = useTransform(smooth, [0, 1], [0.45, 1]);
  const markOpacity = useTransform(smooth, [0, 1], [0.92, 1]);

  const live = state === "listening" || state === "speaking";

  useEffect(() => {
    if (!live || !level || reduce) {
      raw.set(0);
      return;
    }
    let frame = 0;
    const tick = () => {
      raw.set(level.get());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live, level, raw, reduce]);

  const busy = state === "thinking" || state === "connecting";
  const dim = state === "ended";

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
      data-orb-state={state}
    >
      {/* Breathing halo in the Persona Band's LED colours (lavender → blue → aqua) */}
      <motion.div
        className="absolute inset-[-24%] rounded-full"
        style={{ scale: glowScale, opacity: dim ? 0.3 : glowOpacity }}
      >
        <div className={`h-full w-full rounded-full ${live || reduce ? "" : "animate-breathe"}`}>
          <div
            className="h-full w-full rounded-full animate-led opacity-80"
            style={{
              filter: "blur(22px)",
              maskImage: "radial-gradient(circle, black 30%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(circle, black 30%, transparent 70%)",
            }}
          />
        </div>
      </motion.div>

      {/* LED ring, like the Band's: on while Persona is listening or speaking */}
      {live ? (
        <motion.span
          className="absolute inset-[-6%] rounded-full border-[1.5px] animate-led-ring"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ scale }}
        />
      ) : null}

      {/* Listening ripples */}
      {state === "listening" && !reduce ? (
        <>
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border border-[#b7c2d9]"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.2, ease: "easeOut" }}
            />
          ))}
        </>
      ) : null}

      {/* The sphere */}
      <motion.div
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{
          scale,
          background:
            "radial-gradient(circle at 32% 26%, #55555c 0%, #26262b 26%, #0c0c0e 58%, #000 100%)",
          boxShadow:
            "inset 0 2px 1.5px rgb(255 255 255 / 0.35), inset 0 -14px 28px rgb(140 160 200 / 0.16), inset 0 0 0 1px rgb(255 255 255 / 0.06), 0 24px 48px -16px rgb(0 0 0 / 0.55), 0 6px 14px -6px rgb(0 0 0 / 0.35)",
        }}
      >
        {/* Rotating sheen while busy */}
        {busy ? (
          <div
            className="absolute inset-[-20%] animate-shimmer opacity-50"
            style={{
              background: "conic-gradient(from 0deg, transparent 0 55%, rgb(255 255 255 / 0.28) 70%, transparent 85%)",
            }}
          />
        ) : null}
        {/* Specular highlight */}
        <div
          className="absolute rounded-[50%]"
          style={{
            left: "16%",
            top: "7%",
            width: "52%",
            height: "30%",
            transform: "rotate(-18deg)",
            background: "radial-gradient(ellipse at 50% 40%, rgb(255 255 255 / 0.55), rgb(255 255 255 / 0) 70%)",
            filter: "blur(1px)",
          }}
        />
        {/* Bottom rim reflection */}
        <div
          className="absolute inset-x-[18%] bottom-[5%] h-[18%] rounded-[50%]"
          style={{ background: "radial-gradient(ellipse at 50% 100%, rgb(200 215 255 / 0.22), transparent 70%)" }}
        />
        {/* Mark */}
        <motion.div className="absolute inset-0 flex items-center justify-center" style={{ opacity: markOpacity }}>
          {/* ~34% of the orb reads well at every size */}
          <PersonaMark
            className="h-auto text-white drop-shadow-[0_0_10px_rgb(255_255_255/0.35)]"
            style={{ width: Math.round(size * 0.34) }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
