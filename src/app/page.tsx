import { BandSection } from "@/components/landing/BandSection";
import { Hero } from "@/components/landing/Hero";
import { PrivacySection } from "@/components/landing/PrivacySection";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteNav } from "@/components/landing/SiteNav";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <BandSection />
        <PrivacySection />
      </main>
      <SiteFooter />
    </>
  );
}
