import { faq } from "@/content/faq";
import { leistungen } from "@/content/leistungen";
import { site } from "@/content/site";

/**
 * Strukturierte Daten für Local SEO.
 *
 * Alle Stammdaten (Adresse, Telefon, E-Mail, Sprechzeiten) sind echte,
 * von der Bestandsseite übernommene Praxisdaten. Sollte site.ts wieder
 * Musterdaten enthalten, isPlaceholderData auf true setzen – dann werden
 * E-Mail und Öffnungszeiten hier ausgespart.
 */

export function buildPhysicianJsonLd() {
  const base = {
    "@context": "https://schema.org",
    "@type": ["Physician", "MedicalBusiness"],
    name: `${site.name} – ${site.doctor}`,
    url: site.url,
    medicalSpecialty: "Proktologie",
    areaServed: ["Hamburg-Eimsbüttel", "Hamburg"],
    telephone: site.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      postalCode: site.address.zip,
      addressLocality: site.address.city,
      addressRegion: "Hamburg",
      addressCountry: "DE",
    },
    availableService: leistungen.map((leistung) => ({
      "@type": "MedicalProcedure",
      name: leistung.title,
    })),
  };

  if (site.isPlaceholderData) return base;

  return {
    ...base,
    email: site.email,
    faxNumber: site.fax,
    // Aus site.hoursJsonLd – eine Quelle für UI und Markup
    openingHoursSpecification: site.hoursJsonLd.map((entry) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: entry.dayOfWeek,
      opens: entry.opens,
      closes: entry.closes,
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
