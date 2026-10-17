import { Icon } from "@/components/ui/Icon";
import { terminSection } from "@/content/booking";
import { site } from "@/content/site";
import type { ReactNode } from "react";

/**
 * Ruhige Ersatzseite für „gibt es nicht“ und „ist schiefgelaufen“: eine
 * klare Aussage, ein oder zwei Wege weiter und immer das Telefon – wer
 * hier landet, wollte meist einen Termin.
 */
export function NoticePage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 pt-36 pb-24 md:px-8">
        <h1 className="font-display text-4xl leading-tight font-medium text-balance text-ink md:text-5xl">{title}</h1>
        <div className="mt-10 flex flex-wrap items-center gap-4">{children}</div>
        <p className="mt-8 flex items-center gap-3 text-ink/80">
          <Icon name="phone" size={18} className="shrink-0 text-primary-deep" />
          <span>
            {terminSection.phoneLabel}:{" "}
            <a
              href={site.phoneHref}
              className="font-medium text-ink underline underline-offset-4 hover:text-primary-deep max-md:inline-flex max-md:min-h-11 max-md:items-center"
            >
              {site.phone}
            </a>
          </span>
        </p>
      </div>
    </div>
  );
}
