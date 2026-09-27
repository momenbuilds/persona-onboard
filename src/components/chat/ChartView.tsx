"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo, useState } from "react";
import type { ChartSpec } from "@/lib/chat/protocol";

const SERIES = ["#0a84ff", "#1d1d1f", "#8e8e93", "#4ebaff"];
const SLICES = ["#0a84ff", "#1d1d1f", "#6e6e73", "#4ebaff", "#b6cdf6", "#3a3a3c", "#d2d2d7", "#9fc5ff"];

const W = 600;
const PAD = { top: 14, right: 12, bottom: 30, left: 44 };

function fmt(n: number, unit?: string) {
  const abs = Math.abs(n);
  const v =
    abs >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : abs >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : abs >= 1e4 ? `${+(n / 1e3).toFixed(1)}k` : `${+n.toFixed(2)}`;
  if (!unit) return v;
  return unit === "$" || unit === "€" || unit === "£" ? `${unit}${v}` : `${v}${unit.length <= 2 ? "" : " "}${unit}`;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

type Props = { chart: ChartSpec; height?: number; showStats?: boolean };

/** Animated SVG chart: bar, line, area, pie, donut. No chart library, so it stays light. */
export function ChartView({ chart, height = 220, showStats = true }: Props) {
  const reduce = useReducedMotion();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const radial = chart.type === "pie" || chart.type === "donut";

  const summary = `${chart.title}. ${chart.labels
    .map((l, i) => `${l}: ${chart.series.map((s) => fmt(s.values[i] ?? 0, chart.unit)).join(", ")}`)
    .join("; ")}`;

  return (
    <div>
      {showStats && chart.stats?.length ? (
        <div className={`mb-3 grid gap-2`} style={{ gridTemplateColumns: `repeat(${chart.stats.length}, minmax(0,1fr))` }}>
          {chart.stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="rounded-2xl bg-surface px-3 py-2.5"
            >
              <p className="text-[17px] font-semibold tracking-[-0.02em] tabular-nums">{s.value}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-muted">{s.label}</p>
            </motion.div>
          ))}
        </div>
      ) : null}

      <div className="relative" role="img" aria-label={summary}>
        {radial ? (
          <Radial chart={chart} reduce={!!reduce} hover={hover} setHover={setHover} />
        ) : (
          <Cartesian chart={chart} height={height} gid={gid} reduce={!!reduce} hover={hover} setHover={setHover} />
        )}
      </div>

      {!radial && chart.series.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {chart.series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}

      <table className="sr-only">
        <caption>{chart.title}</caption>
        <thead>
          <tr>
            <th>label</th>
            {chart.series.map((s) => (
              <th key={s.name}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.labels.map((l, i) => (
            <tr key={l + i}>
              <td>{l}</td>
              {chart.series.map((s) => (
                <td key={s.name}>{s.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cartesian({
  chart,
  height,
  gid,
  reduce,
  hover,
  setHover,
}: {
  chart: ChartSpec;
  height: number;
  gid: string;
  reduce: boolean;
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const H = height;
  const n = chart.labels.length;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const all = chart.series.flatMap((s) => s.values);
  const min = Math.min(0, ...all);
  const max = niceMax(Math.max(...all, 0));
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min || 1)) * innerH;
  const col = innerW / n;
  const cx = (i: number) => PAD.left + col * i + col / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  const labelEvery = Math.ceil(n / 8);

  const lines = useMemo(
    () => chart.series.map((s) => s.values.map((v, i) => [cx(i), y(v)] as [number, number])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chart, H],
  );

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs>
          {chart.series.map((_, si) => (
            <linearGradient key={si} id={`${gid}-fill-${si}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={SERIES[si % SERIES.length]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SERIES[si % SERIES.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#000" strokeOpacity={i === 0 ? 0.12 : 0.05} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[11px] tabular-nums">
              {fmt(t, chart.unit)}
            </text>
          </g>
        ))}

        {chart.labels.map((l, i) =>
          i % labelEvery === 0 ? (
            <text key={l + i} x={cx(i)} y={H - 8} textAnchor="middle" className={`text-[11px] ${hover === i ? "fill-ink" : "fill-muted"}`}>
              {l}
            </text>
          ) : null,
        )}

        {hover !== null ? <rect x={PAD.left + col * hover} y={PAD.top} width={col} height={innerH} fill="#000" fillOpacity={0.03} rx={8} /> : null}

        {chart.type === "bar"
          ? chart.series.map((s, si) => {
              const groupW = Math.min(col * 0.7, 56);
              const bw = groupW / chart.series.length;
              return s.values.map((v, i) => {
                const x = cx(i) - groupW / 2 + bw * si + 1;
                const top = y(Math.max(v, 0));
                const h = Math.abs(y(v) - y(0));
                return (
                  <motion.rect
                    key={`${si}-${i}`}
                    x={x}
                    width={Math.max(bw - 2, 2)}
                    rx={Math.min(6, bw / 3)}
                    fill={SERIES[si % SERIES.length]}
                    initial={reduce ? false : { y: y(0), height: 0 }}
                    animate={{ y: top, height: h, opacity: hover === null || hover === i ? 1 : 0.45 }}
                    transition={{ type: "spring", stiffness: 170, damping: 22, delay: reduce ? 0 : 0.04 * i + 0.05 * si }}
                  />
                );
              });
            })
          : lines.map((pts, si) => (
              <g key={si}>
                {chart.type === "area" ? (
                  <motion.path
                    d={`${smooth(pts)} L${pts[pts.length - 1][0]},${y(Math.max(min, 0))} L${pts[0][0]},${y(Math.max(min, 0))} Z`}
                    fill={`url(#${gid}-fill-${si})`}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                  />
                ) : null}
                <motion.path
                  d={smooth(pts)}
                  fill="none"
                  stroke={SERIES[si % SERIES.length]}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: si * 0.12 }}
                />
                {pts.map(([px, py], i) => (
                  <motion.circle
                    key={i}
                    cx={px}
                    cy={py}
                    fill="#fff"
                    stroke={SERIES[si % SERIES.length]}
                    strokeWidth={2}
                    initial={reduce ? false : { r: 0 }}
                    animate={{ r: hover === i ? 5 : n > 12 ? 0 : 3.2 }}
                    transition={{ delay: reduce ? 0 : 0.7 + i * 0.03 }}
                  />
                ))}
              </g>
            ))}

        {chart.labels.map((_, i) => (
          <rect
            key={i}
            x={PAD.left + col * i}
            y={PAD.top}
            width={col}
            height={innerH + PAD.bottom}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
          />
        ))}
      </svg>

      {hover !== null ? (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl bg-ink px-2.5 py-1.5 text-[12px] text-white shadow-lg"
          style={{ left: `${(cx(hover) / W) * 100}%` }}
        >
          <p className="font-semibold">{chart.labels[hover]}</p>
          {chart.series.map((s, si) => (
            <p key={s.name} className="flex items-center gap-1.5 tabular-nums text-white/85">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: si === 1 ? "#fff" : SERIES[si % SERIES.length] }} />
              {chart.series.length > 1 ? `${s.name}: ` : ""}
              {fmt(s.values[hover] ?? 0, chart.unit)}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Radial({
  chart,
  reduce,
  hover,
  setHover,
}: {
  chart: ChartSpec;
  reduce: boolean;
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const values = chart.series[0].values.map((v) => Math.max(0, v));
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const donut = chart.type === "donut";
  const r = donut ? 62 : 42;
  const stroke = donut ? 26 : 84;
  const C = 2 * Math.PI * r;
  const starts = values.map((_, i) => values.slice(0, i).reduce((a, b) => a + b, 0) / total * C);
  const focus = hover ?? values.indexOf(Math.max(...values));

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
      <svg viewBox="0 0 180 180" className="h-[170px] w-[170px] shrink-0 -rotate-90" onMouseLeave={() => setHover(null)}>
        {values.map((v, i) => {
          const len = (v / total) * C;
          const offset = -starts[i];
          return (
            <motion.circle
              key={i}
              cx={90}
              cy={90}
              r={r}
              fill="none"
              stroke={SLICES[i % SLICES.length]}
              strokeWidth={hover === i ? stroke + 6 : stroke}
              strokeDashoffset={offset}
              initial={reduce ? false : { strokeDasharray: `0 ${C}` }}
              animate={{ strokeDasharray: `${Math.max(len - (donut ? 2 : 0.5), 0)} ${C}` }}
              transition={{ duration: 0.7, delay: reduce ? 0 : i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setHover(i)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
      </svg>
      {donut ? (
        <div className="pointer-events-none absolute left-[85px] top-[85px] hidden -translate-x-1/2 -translate-y-1/2 text-center sm:block">
          <p className="text-[18px] font-semibold tabular-nums">{Math.round((values[focus] / total) * 100)}%</p>
          <p className="max-w-[80px] truncate text-[11px] text-muted">{chart.labels[focus]}</p>
        </div>
      ) : null}
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-1">
        {chart.labels.map((l, i) => (
          <li
            key={l + i}
            className={`flex items-center gap-2 transition-opacity ${hover === null || hover === i ? "opacity-100" : "opacity-50"}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SLICES[i % SLICES.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{l}</span>
            <span className="tabular-nums text-muted">{Math.round((values[i] / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
