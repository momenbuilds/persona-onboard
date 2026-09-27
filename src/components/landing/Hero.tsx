import Image from "next/image";
import { PersonaLockup } from "@/components/brand/PersonaLogo";
import { ButtonLink } from "@/components/ui/Button";
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
        <ButtonLink href="/start" variant="glass" size="lg" className="mt-9 pl-5 pr-7 text-[18px]">
          <span aria-hidden className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#55555c,#0c0c0e_60%,#000)]" />
            <span className="absolute inset-[-4px] animate-ping rounded-full bg-black/10" />
          </span>
          Get Started
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
