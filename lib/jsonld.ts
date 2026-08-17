import { faq } from "@/content/faq";
import { leistungen } from "@/content/leistungen";
import { site } from "@/content/site";

/**
 * Strukturierte Daten für Local SEO.
 * Die Kontaktdaten stammen aus content/site.ts und sind dort als
 * [PLATZHALTER] markiert – vor Launch ersetzen.
 */

export function buildPhysicianJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["Physician", "MedicalBusiness"],
    name: `${site.name} – ${site.doctor}`,
    url: site.url,
    telephone: site.phone,
    email: site.email,
    medicalSpecialty: "Proktologie",
    areaServed: ["Hamburg-Eimsbüttel", "Hamburg"],
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      postalCode: site.address.zip,
      addressLocality: site.address.city,
      addressRegion: "Hamburg",
      addressCountry: "DE",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "08:00",
        closes: "17:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Friday",
        opens: "08:00",
        closes: "13:00",
      },
    ],
    availableService: leistungen.map((leistung) => ({
      "@type": "MedicalProcedure",
      name: leistung.title,
    })),
  };
}

export function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    // Wortidentisch mit dem sichtbaren FAQ-Accordion (gleiche Quelle)
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
