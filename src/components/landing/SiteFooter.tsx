import Image from "next/image";
import Link from "next/link";
import { PersonaLockup } from "@/components/brand/PersonaLogo";
import { ButtonLink } from "@/components/ui/Button";
import { MailIcon, XLogoIcon } from "@/components/ui/icons";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Persona App", href: "/start" },
      { label: "Persona Band", href: "https://yourpersona.com/band" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Privacy", href: "https://yourpersona.com/legal/privacy" },
      { label: "Terms", href: "https://yourpersona.com/legal" },
      { label: "Contact", href: "mailto:hello@yourpersona.com" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden px-4 pb-0 pt-10">
      <div className="relative z-10 mx-auto max-w-5xl rounded-[32px] bg-white p-8 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_30px_70px_-30px_rgb(0_0_0/0.25)] sm:p-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <PersonaLockup height={22} />
            <p className="mt-5 text-[18px] font-semibold tracking-[-0.01em]">Create your Persona today.</p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              First AI assistant you can wear.
              <br />
              Made to get it done.
            </p>
            <ButtonLink href="/start" size="sm" className="mt-5 h-10 px-5">
              Start your Persona
            </ButtonLink>
            <div className="mt-5 flex gap-2">
              <a
                href="mailto:hello@yourpersona.com"
                aria-label="Email Persona"
                className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full"
              >
                <MailIcon className="h-[18px] w-[18px]" />
              </a>
              <a
                href="https://x.com/yourpersona"
                aria-label="Persona on X"
                className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full"
              >
                <XLogoIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-[14px] font-semibold">{col.title}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith("/") ? (
                      <Link href={l.href} className="rounded text-[14px] text-muted transition-colors hover:text-ink">
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} className="rounded text-[14px] text-muted transition-colors hover:text-ink">
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="md:text-right">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">Security &amp; privacy</p>
            <div className="mt-4 flex gap-3 md:justify-end">
              {["/brand/certs/aes-256.svg", "/brand/certs/soc2.png", "/brand/certs/esof.png"].map((src) => (
                <Image key={src} src={src} alt="" width={36} height={36} className="h-9 w-9 object-contain" unoptimized />
              ))}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              Encrypted at rest and in transit.
              <br />
              Your data stays yours.
            </p>
          </div>
        </div>
        <p className="mt-10 text-[12.5px] leading-relaxed text-muted">
          © 2026 Persona. All rights reserved.
          <br />
          Made in Miami, USA.
        </p>
      </div>

      {/* Giant wordmark, bleeding off the bottom */}
      <div aria-hidden className="relative mx-auto -mt-2 max-w-6xl translate-y-[22%] px-4 opacity-[0.07]">
        <Image src="/brand/persona-lockup.svg" alt="" width={1160} height={230} className="h-auto w-full" unoptimized />
      </div>
    </footer>
  );
}
