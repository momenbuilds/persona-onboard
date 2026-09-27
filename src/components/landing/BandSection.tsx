import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";

const SPECS = [
  { value: "27 grams", label: "You'll forget it's on." },
  { value: "3 days", label: "One charge. Gone all weekend." },
  { value: "Two mics", label: "Hears a whisper." },
];

export function BandSection() {
  return (
    <section id="band" className="mx-auto w-full max-w-6xl px-6 py-28 sm:py-36" aria-labelledby="band-title">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <Image
            src="/brand/band/side-knit.webp"
            alt="Persona Band in black Jacquard knit, with its glowing LED ring"
            width={900}
            height={1140}
            sizes="(min-width: 640px) 320px, 62vw"
            className="h-auto w-[62vw] max-w-[320px]"
          />
          <span
            aria-hidden
            className="absolute -bottom-6 left-1/2 h-8 w-[70%] -translate-x-1/2 rounded-[50%] bg-black/15 blur-xl"
          />
        </div>

        <h2 id="band-title" className="mt-16 text-[52px] font-normal leading-none tracking-[-0.045em] sm:text-[80px]">
          Persona Band
        </h2>
        <p className="mt-5 text-[20px] text-ink-soft sm:text-[22px]">Personal intelligence, on your wrist.</p>
        <ButtonLink href="https://yourpersona.com/band" size="sm" className="mt-8 h-10 px-5">
          Learn more
        </ButtonLink>
      </div>

      <div className="mt-24 grid items-stretch gap-4 md:grid-cols-[1.35fr_1fr]">
        <div className="relative min-h-[300px] overflow-hidden rounded-[32px]">
          <Image
            src="/brand/band/knit-black.webp"
            alt="Someone laughing in a car, wearing Persona Band"
            fill
            sizes="(min-width: 768px) 60vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
            {["Reply drafted · waiting for your OK", "Dentist booked · Tue 9:15am"].map((chip) => (
              <span key={chip} className="liquid-glass rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ink">
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-[32px] bg-surface p-8">
          <div>
            <h3 className="text-[32px] font-medium leading-[1.05] tracking-[-0.035em]">Just say what you need.</h3>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              Talk naturally and let your Persona handle the rest. No prompts to learn, nothing to set up.
            </p>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-3">
            {SPECS.map((s) => (
              <div key={s.value}>
                <dt className="text-[18px] font-semibold tracking-[-0.02em]">{s.value}</dt>
                <dd className="mt-1 text-[13px] leading-snug text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
