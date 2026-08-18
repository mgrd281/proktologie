import { Button } from "@/components/ui/Button";
import { HeroMobileMedia } from "@/components/hero/HeroMobileMedia";
import { Icon } from "@/components/ui/Icon";
import { heroBeats } from "@/content/hero";

/**
 * Statische Hero-Variante: Mobile/Tablet sowie alle Viewports bei
 * prefers-reduced-motion. Gleiche Identität, ohne Scroll-Kopplung –
 * schnell, ruhig und vollständig ohne JavaScript nutzbar.
 */

/** Kompakte Teaser auf die wichtigsten Abschnitte (statt der Scroll-Beats). */
const teasers = [
  { label: "Beschwerden", note: "Häufig – und gut behandelbar", href: "/#beschwerden" },
  { label: "Diagnostik", note: "Behutsam und gründlich", href: "/#diagnostik" },
  { label: "Termin", note: "Der erste Schritt ist einfach", href: "/#kontakt" },
];

export function HeroStatic() {
  const welcome = heroBeats[0];

  return (
    <div className="on-dark relative overflow-hidden bg-deep text-cream">
      <div className="mx-auto flex min-h-svh max-w-7xl flex-col justify-end px-5 pt-28 pb-10 md:px-8">
        <div className="grid items-end gap-10 lg:grid-cols-2">
          <div className="max-w-xl">
            <p className="flex items-center gap-2.5 text-[13px] font-medium tracking-wide text-cream/75">
              <Icon name="pin" size={15} className="text-accent" />
              {welcome.kicker}
            </p>
            <h1 className="font-display mt-5 text-5xl leading-[1.05] font-medium text-balance md:text-6xl">
              <span className="block text-white">{welcome.headline[0]}</span>
              <span className="block text-accent">{welcome.headline[1]}</span>
            </h1>
            <p className="mt-6 flex items-center gap-4 text-lg text-cream md:text-xl">
              <span aria-hidden="true" className="h-px w-10 bg-accent/60" />
              Dr. Kai Kunstreich
            </p>
            <p className="mt-5 max-w-md leading-relaxed text-cream/75">
              {welcome.text}
            </p>
            {welcome.cta && (
              <div className="mt-8">
                <Button href={welcome.cta.href} withArrow>
                  {welcome.cta.label}
                </Button>
              </div>
            )}
          </div>

          <HeroMobileMedia className="aspect-[3/4] max-h-[52svh] w-full max-w-sm justify-self-center lg:mb-2 lg:justify-self-end" />
        </div>

        <nav aria-label="Direkt zu den wichtigsten Abschnitten" className="mt-12">
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
            {teasers.map((teaser) => (
              <li key={teaser.href} className="bg-deep">
                <a
                  href={teaser.href}
                  className="group flex h-full flex-col gap-1 p-5 transition-colors hover:bg-white/5"
                >
                  <span className="flex items-center justify-between text-sm font-medium text-white">
                    {teaser.label}
                    <Icon
                      name="arrow-right"
                      size={16}
                      className="text-accent transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </span>
                  <span className="text-xs text-cream/55">{teaser.note}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
