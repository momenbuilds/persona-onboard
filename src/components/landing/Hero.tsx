import Image from "next/image";
import { PersonaLockup, PersonaMark } from "@/components/brand/PersonaLogo";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { HeroPhoneDemo } from "./HeroPhoneDemo";

export function Hero() {
  return (
    <section className="relative mx-auto grid min-h-[100svh] w-full max-w-6xl items-center gap-14 px-6 pb-20 pt-24 md:grid-cols-2 md:gap-8 md:pt-16">
      {/* Phone + misty backdrop */}
      <div className="relative order-2 flex justify-center md:order-1">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[150%] max-w-[640px] -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ maskImage: "radial-gradient(closest-side, black 42%, transparent 100%)", WebkitMaskImage: "radial-gradient(closest-side, black 42%, transparent 100%)" }}
        >
          <Image src="/brand/hero-backdrop.jpg" alt="" fill sizes="640px" className="object-cover grayscale-[35%]" priority />
        </div>
        <div className="relative">
          <HeroPhoneDemo />
        </div>
      </div>

      {/* Copy */}
      <div className="order-1 flex flex-col items-center text-center md:order-2">
        <PersonaLockup height={30} priority />
        <h1 className="mt-7 text-balance text-[46px] font-medium leading-[1.02] tracking-[-0.032em] sm:text-[60px] lg:text-[68px]">
          Your personal intelligence
        </h1>
        <p className="mt-5 max-w-[26rem] text-pretty text-[18px] leading-relaxed text-muted">
          Start with a quick call. Persona learns what matters to you, then gets to work.
        </p>
        <ButtonLink href="/start" variant="glass" size="lg" className="group mt-9 gap-3 pl-2.5 pr-6 text-[18px]">
          {/* A mini Persona orb: glossy sphere + mark, with the Band's LED glow breathing around it. */}
          <span aria-hidden className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            <span className="absolute inset-[-3px] animate-led-ring rounded-full border" />
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_28%,#5c5c63,#151517_58%,#000)] shadow-[inset_0_1px_1px_rgb(255_255_255/0.28),0_3px_8px_-2px_rgb(0_0_0/0.35)]">
              <PersonaMark className="h-[15px] w-[15px] text-white" />
            </span>
          </span>
          Get Started
          <ArrowRightIcon aria-hidden className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </ButtonLink>
        <a
          href="https://app.yourpersona.com/"
          className="mt-5 rounded-md text-[15px] text-muted transition-colors hover:text-ink"
        >
          Log in to the dashboard
        </a>
      </div>
    </section>
  );
}
