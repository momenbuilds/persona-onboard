"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PersonaLockup } from "@/components/brand/PersonaLogo";
import { ChevronIcon, EyeOffIcon, LockIcon, PlusIcon, ShieldIcon, TrashIcon } from "@/components/ui/icons";

const CARDS = [
  {
    icon: ShieldIcon,
    lead: "Independently audited.",
    rest: "Checked by outside auditors.",
    body: "SOC 2 Type I. AES-256. ESOF verified. Independent auditors look at how we handle your data, so you don't have to take our word for it.",
  },
  {
    icon: LockIcon,
    lead: "Encrypted at rest.",
    rest: "Sealed before it's stored.",
    body: "Every message, document and recap is sealed with envelope encryption before it reaches our storage, and travels over TLS on the way. Each record gets its own key.",
  },
  {
    icon: EyeOffIcon,
    lead: "Never sold, never traded.",
    rest: "Not a product, not to anyone.",
    body: "Your conversations are not a product. Not to advertisers, not to data brokers, not to anyone.",
  },
  {
    icon: TrashIcon,
    lead: "Yours to delete.",
    rest: "Gone means gone.",
    body: "Export everything in one tap, or wipe a task, a day, or all of it. Gone means gone, on our servers too.",
  },
];

const SEALS = [
  { src: "/brand/certs/soc2.png", label: "SOC 2 Type I", sub: "certified" },
  { src: "/brand/certs/aes-256.svg", label: "AES-256", sub: "Encrypted" },
  { src: "/brand/certs/esof.png", label: "ESOF verified", sub: "and secured" },
];

export function PrivacySection() {
  const rail = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector("li");
    el.scrollBy({ left: dir * ((card?.clientWidth ?? 300) + 12), behavior: "smooth" });
  };

  return (
    <section id="privacy" className="mx-auto w-full max-w-6xl py-24 sm:py-32" aria-labelledby="privacy-title">
      <div className="flex flex-col gap-10 px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <PersonaLockup height={22} />
          <h2 id="privacy-title" className="mt-4 text-[38px] leading-[1.05] tracking-[-0.04em] sm:text-[52px]">
            The most <strong className="font-semibold">personal</strong> AI
            <br />
            is the most <strong className="font-semibold">private</strong> one.
          </h2>
        </div>
        <ul className="flex gap-6" aria-label="Certifications">
          {SEALS.map((s) => (
            <li key={s.label} className="flex flex-col items-center text-center">
              <Image src={s.src} alt="" width={48} height={48} className="h-12 w-12 object-contain" unoptimized />
              <span className="mt-2 text-[11.5px] leading-tight text-muted">
                {s.label}
                <br />
                {s.sub}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul ref={rail} className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 pb-4">
        {CARDS.map((c, i) => {
          const Icon = c.icon;
          const isOpen = open === i;
          return (
            <li key={c.lead} className="w-[82vw] max-w-[290px] shrink-0 snap-start sm:w-[290px]">
              <div className="relative flex h-[270px] flex-col rounded-[28px] bg-surface p-6">
                <Icon className="h-9 w-9 text-ios-blue" />
                <AnimatePresence mode="wait" initial={false}>
                  {isOpen ? (
                    <motion.p
                      key="body"
                      id={`privacy-${i}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-5 text-[15px] leading-relaxed text-ink-soft"
                    >
                      {c.body}
                    </motion.p>
                  ) : (
                    <motion.p
                      key="title"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-7 text-[21px] font-semibold leading-[1.2] tracking-[-0.02em]"
                    >
                      <span className="text-ios-blue">{c.lead}</span>
                      <br />
                      {c.rest}
                    </motion.p>
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? `privacy-${i}` : undefined}
                  aria-label={isOpen ? `Close: ${c.lead}` : `More about: ${c.lead}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="absolute bottom-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.07] text-ink transition-colors hover:bg-black/[0.12]"
                >
                  <PlusIcon className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex justify-end gap-2 px-6">
        <button
          type="button"
          aria-label="Previous"
          disabled={edges.start}
          onClick={() => scrollBy(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface transition-opacity disabled:opacity-40"
        >
          <ChevronIcon className="h-4 w-4 -scale-x-100" />
        </button>
        <button
          type="button"
          aria-label="Next"
          disabled={edges.end}
          onClick={() => scrollBy(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface transition-opacity disabled:opacity-40"
        >
          <ChevronIcon className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
