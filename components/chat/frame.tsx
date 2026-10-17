import { Icon } from "@/components/ui/Icon";
import { chatCopy, type ChatLang } from "@/content/chat";
import { site } from "@/content/site";

/**
 * Was Sofort-Rahmen (ChatWidget, steht schon da, während das Fenster lädt)
 * und Fenster (ChatWindow) teilen – damit beim Wechsel nichts springt.
 */

/**
 * z-[60]: über dem festen Seitenkopf (z-50). Sonst deckt der Kopf auf
 * niedrigen Bildschirmen die obere Leiste des Fensters ab, und
 * „English“, „Neues Gespräch“ und „Schließen“ sind nicht anklickbar.
 * outline-none!: Der Rahmen bekommt den Fokus nur per Skript, als
 * Landepunkt des Dialogs – er ist kein Bedienelement.
 */
export const chatWindowClass =
  "fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-mist bg-cream shadow-2xl outline-none! sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,80dvh)] sm:w-[400px] sm:rounded-2xl";

export const chatHeaderClass = "flex items-center justify-between gap-3 border-b border-mist bg-white/70 px-4 py-3";

export const chatCloseClass =
  "rounded-lg p-1.5 text-ink/70 hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-md:flex max-md:size-11 max-md:items-center max-md:justify-center";

/** Name und Zweck des Fensters – nie abgeschnitten, lieber zweizeilig. */
export function ChatTitle({ lang }: { lang: ChatLang }) {
  const copy = chatCopy[lang];
  return (
    <div className="min-w-0">
      <p className="text-sm leading-snug font-semibold text-ink">{copy.windowTitle}</p>
      <p className="text-xs text-ink/70">{copy.windowSubtitle}</p>
    </div>
  );
}

/** Ohne Cockpit, mit abgeschaltetem Chat oder wenn das Fenster nicht lädt: Telefon und Sprechzeiten. */
export function ChatOffline({ lang, hours }: { lang: ChatLang; hours: string }) {
  const copy = chatCopy[lang];
  return (
    <div className="flex-1 px-4 py-6">
      <p className="text-sm font-semibold text-ink">{copy.offlineTitle}</p>
      <p className="mt-2 text-sm text-ink/80">{copy.offline(hours)}</p>
      <a
        href={site.phoneHref}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-cream hover:bg-primary-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name="phone" size={16} />
        {copy.callLabel}
      </a>
    </div>
  );
}
