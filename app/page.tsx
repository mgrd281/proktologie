import { MasterSequence } from "@/components/cinema/MasterSequence";
import { Beschwerden } from "@/components/sections/Beschwerden";
import { Diagnostik } from "@/components/sections/Diagnostik";
import { Faq } from "@/components/sections/Faq";
import { Intro } from "@/components/sections/Intro";
import { Kontakt } from "@/components/sections/Kontakt";
import { Leistungen } from "@/components/sections/Leistungen";
import { Praxis } from "@/components/sections/Praxis";
import { UeberDenArzt } from "@/components/sections/UeberDenArzt";
import { WarumWir } from "@/components/sections/WarumWir";
import { buildFaqJsonLd, buildPhysicianJsonLd } from "@/lib/jsonld";

export default function HomePage() {
  return (
    <>
      {/* Eine durchgehende Kamerafahrt: 01 Willkommen … 07 Praxis */}
      <MasterSequence />

      {/* Ab hier die ausführliche, ruhige Website */}
      <Intro />
      <Leistungen />
      <Beschwerden />
      <Diagnostik />
      <UeberDenArzt />
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
