"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PersonaLockup } from "@/components/brand/PersonaLogo";
import { ButtonLink } from "@/components/ui/Button";

/** Floating glass nav that appears once the hero scrolls away. */
export function SiteNav() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.nav
          aria-label="Main"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 top-3 z-50 flex justify-center px-4"
        >
          <div className="liquid-glass flex w-full max-w-md items-center justify-between gap-2 rounded-full py-1.5 pl-5 pr-1.5">
            <Link href="/" aria-label="Persona home" className="rounded-md">
              <PersonaLockup height={18} />
            </Link>
            <div className="flex items-center gap-1">
              <a href="#band" className="hidden rounded-full px-3 py-1.5 text-[13px] text-muted hover:text-ink sm:block">
                Band
              </a>
              <a href="#privacy" className="hidden rounded-full px-3 py-1.5 text-[13px] text-muted hover:text-ink sm:block">
                Privacy
              </a>
              <ButtonLink href="/start" size="sm" className="h-8 px-4 text-[13px]">
                Get Started
              </ButtonLink>
            </div>
          </div>
        </motion.nav>
      ) : null}
    </AnimatePresence>
  );
}
