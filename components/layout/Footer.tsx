import Link from "next/link";
import { LogoLockup } from "@/components/ui/Logo";
import { legalNavigation, navigation } from "@/content/navigation";
import { footerContent } from "@/content/sections";
import { site } from "@/content/site";

/** Footer in Deep Green – Navigation, Kontakt (Platzhalter), Rechtliches. */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="on-dark bg-deep text-cream">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <LogoLockup onDark />
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-cream/60">
              {footerContent.tagline}
            </p>
          </div>

          <nav aria-label="Footer-Navigation">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              {footerContent.navTitle}
            </h2>
            <ul className="mt-5 space-y-2.5">
              {navigation.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-cream/70 underline-offset-4 hover:text-white hover:underline"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              {footerContent.contactTitle}
            </h2>
            <address className="mt-5 space-y-2.5 text-sm text-cream/70 not-italic">
              <p>
                {site.name}
                <br />
                {site.address.street}
                <br />
                {site.address.zip} {site.address.city} – {site.address.district}
              </p>
              <p>
                <a
                  href={site.phoneHref}
                  className="underline-offset-4 hover:text-white hover:underline"
                >
                  {site.phone}
                </a>
                <br />
                <a
                  href={`mailto:${site.email}`}
                  className="underline-offset-4 hover:text-white hover:underline"
                >
                  {site.email}
                </a>
              </p>
            </address>
          </div>

          <nav aria-label="Rechtliches">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              {footerContent.legalTitle}
            </h2>
            <ul className="mt-5 space-y-2.5">
              {legalNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-cream/70 underline-offset-4 hover:text-white hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 pt-7 text-xs text-cream/45 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {site.name} – {site.doctor}
          </p>
          <p>{footerContent.note}</p>
        </div>
      </div>
    </footer>
  );
}
