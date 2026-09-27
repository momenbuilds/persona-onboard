"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { LevelSource } from "@/lib/voice/level";

type Props = {
  level: LevelSource;
  active: boolean;
  bars?: number;
  height?: number;
  className?: string;
  color?: string;
};

/**
 * Voice-memo style waveform drawn on a canvas. Bar heights follow the live
 * level with a centre-weighted envelope and a little per-bar jitter, so it
 * feels organic without 60fps React renders.
 */
export function Waveform({ level, active, bars = 32, height = 44, className = "", color = "#1d1d1f" }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const heights = new Float32Array(bars);
    let frame = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const v = active ? level.get() : 0;
      const t = performance.now() / 1000;
      const gap = w / bars;
      const barW = Math.max(2, gap * 0.42);

      for (let i = 0; i < bars; i++) {
        const x = i / (bars - 1);
        const envelope = Math.sin(Math.PI * x) ** 0.8;
        const jitter = 0.55 + 0.45 * Math.abs(Math.sin(t * (5 + (i % 5)) + i * 1.7));
        const target = Math.max(barW / h, v * envelope * jitter);
        heights[i] += (target - heights[i]) * (reduce ? 1 : 0.28);
        const bh = Math.max(barW, heights[i] * h);
        ctx.fillStyle = color;
        ctx.globalAlpha = active ? 0.85 : 0.25;
        const bx = i * gap + (gap - barW) / 2;
        const by = (h - bh) / 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, bh, barW / 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [level, active, bars, color, reduce]);

  return <canvas ref={canvas} aria-hidden className={`block w-full ${className}`} style={{ height }} />;
}
