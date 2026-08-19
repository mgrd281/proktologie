import { MasterSequence } from "@/components/cinema/MasterSequence";
import { Beschwerden } from "@/components/sections/Beschwerden";
import { Diagnostik } from "@/components/sections/Diagnostik";
import { Faq } from "@/components/sections/Faq";
import { Kontakt } from "@/components/sections/Kontakt";
import { Leistungen } from "@/components/sections/Leistungen";
import { Praxis } from "@/components/sections/Praxis";
import { UeberDenArzt } from "@/components/sections/UeberDenArzt";
import { WarumWir } from "@/components/sections/WarumWir";
import { buildFaqJsonLd, buildPhysicianJsonLd } from "@/lib/jsonld";

export default function HomePage() {
  return (
    <>
      {/* Eine durchgehende Kamerafahrt: 01 Willkommen … 09 Termin */}
      <MasterSequence />

      {/*
        * Der Auslauf der Fahrt landet farbgleich auf der Buchung – Zustand
        * 09 „Termin“ übergibt direkt an die echte Terminvereinbarung.
        * Danach folgt die ausführliche, ruhige Website (SEO + Nachlesen).
        * Das frühere Intro lebt in Zustand 02 der Fahrt (Kicker, Lead,
        * beide Absätze); die Grundsatz-Marken stehen in CinemaStatic.
        */}
      <Kontakt />
      <Leistungen />
      <Beschwerden />
      <Diagnostik />
      <UeberDenArzt />
      <WarumWir />
      <Praxis />
      <Faq />

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
