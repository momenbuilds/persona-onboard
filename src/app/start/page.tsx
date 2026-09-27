import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding/Onboarding";

export const metadata: Metadata = {
  title: "Get started",
  description: "A two-minute call with Persona so it can get to know you.",
};

export default function StartPage() {
  return <Onboarding />;
}
