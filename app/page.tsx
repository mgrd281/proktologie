import { Hero } from "@/components/hero/Hero";
import { Beschwerden } from "@/components/sections/Beschwerden";
import { Diagnostik } from "@/components/sections/Diagnostik";
import { Faq } from "@/components/sections/Faq";
import { Intro } from "@/components/sections/Intro";
import { Kontakt } from "@/components/sections/Kontakt";
import { Leistungen } from "@/components/sections/Leistungen";
import { Praxis } from "@/components/sections/Praxis";
import { Team } from "@/components/sections/Team";
import { UeberDenArzt } from "@/components/sections/UeberDenArzt";
import { WarumWir } from "@/components/sections/WarumWir";
import { buildFaqJsonLd, buildPhysicianJsonLd } from "@/lib/jsonld";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Intro />
      <Leistungen />
      <Beschwerden />
      <Diagnostik />
      <UeberDenArzt />
      <Team />
      <WarumWir />
      <Praxis />
      <Faq />
      <Kontakt />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildPhysicianJsonLd()),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />
    </>
  );
}
