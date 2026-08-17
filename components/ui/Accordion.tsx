"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { useId, useState } from "react";
import type { FaqItem } from "@/content/faq";

/**
 * Barrierefreies FAQ-Accordion:
 * button[aria-expanded] + region[aria-labelledby], Höhenanimation über
 * CSS-Grid (0fr → 1fr) – ohne JS-Höhenmessung, voll tastaturbedienbar.
 */
export function Accordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((item, index) => {
        const isOpen = open === index;
        const buttonId = `${baseId}-button-${index}`;
        const panelId = `${baseId}-panel-${index}`;
        return (
          <div key={item.question}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex min-h-14 w-full items-center justify-between gap-6 py-5 text-left"
              >
                <span className="font-display text-lg font-medium text-ink md:text-xl">
                  {item.question}
                </span>
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-primary transition-transform duration-300",
                    isOpen && "rotate-45",
                  )}
                >
                  <Icon name="plus" size={16} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn(
                "grid transition-[grid-template-rows] duration-400 ease-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pb-6 leading-relaxed text-ink/75">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
