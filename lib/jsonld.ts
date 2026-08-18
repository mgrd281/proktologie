import { faq } from "@/content/faq";
import { leistungen } from "@/content/leistungen";
import { site } from "@/content/site";

/**
 * Strukturierte Daten für Local SEO.
 *
 * Adresse und Telefon sind echte, geprüfte Praxisdaten und werden immer
 * ausgegeben. Solange site.isPlaceholderData true ist, bleiben E-Mail und
 * Öffnungszeiten (noch Musterdaten) bewusst WEGGELASSEN – Suchmaschinen
 * dürfen keine Musterdaten indexieren. Beim Eintragen der echten Werte in
 * content/site.ts das Flag auf false setzen.
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
    // Aus site.hours abgeleitet – eine Quelle für UI und Markup
    openingHoursSpecification: site.hours
      .filter((entry) => entry.dayOfWeek.length > 0 && entry.opens && entry.closes)
      .map((entry) => ({
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
