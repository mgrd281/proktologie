import { Icon } from "@/components/ui/Icon";
import type { FaqItem } from "@/content/faq";

/**
 * FAQ als <details>: Mehrere Antworten dürfen gleichzeitig offen sein, die
 * Suche im Browser (Strg+F) findet auch Text in zugeklappten Antworten und
 * klappt sie auf, und ohne JavaScript geht alles genauso. Die Höhe gleitet,
 * wo der Browser ::details-content kennt (app/globals.css), sonst klappt
 * die Antwort einfach auf – bei „Bewegung reduzieren“ immer.
 */
export function Accordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((item, index) => (
        <details key={item.question} open={index === 0} className="faq-item group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
            <h3 className="font-display text-lg font-medium text-ink md:text-xl">{item.question}</h3>
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-primary transition-transform duration-300 group-open:rotate-45"
            >
              <Icon name="plus" size={16} />
            </span>
          </summary>
          <p className="max-w-2xl pb-6 leading-relaxed text-ink/75">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
