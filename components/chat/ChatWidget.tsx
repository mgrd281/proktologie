"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatCopy, hoursLine, type ChatLang } from "@/content/chat";
import { site } from "@/content/site";
import { fetchCockpitStatus } from "@/lib/booking/status";
import { Icon } from "@/components/ui/Icon";
import { ctaHref, mobileBar } from "@/content/navigation";

/**
 * Der Einstieg in den Chat: ein runder Knopf unten rechts.
 *
 * Zurückhaltend mit Absicht. Der Knopf ist immer da, aber er springt
 * niemanden an: keine automatisch aufpoppende Blase, kein roter Punkt,
 * keine Begrüßung, die man wegklicken muss. Wer ihn braucht, findet ihn.
 *
 * Das Fenster selbst wird erst beim ersten Öffnen geladen (dynamisch,
 * ohne Server-Rendering). Solange niemand klickt, kostet der Chat nichts
 * als diesen Knopf. Ob es überhaupt ein Fenster gibt, entscheidet die
 * Praxis: Beim ersten Öffnen wird der Zustand des Cockpits abgefragt;
 * ohne Cockpit-Adresse, ohne Antwort oder mit abgeschaltetem Chat zeigt
 * das Fenster nur Telefonnummer und Sprechzeiten.
 *
 * Auf dem Handy (unter md) gibt es den runden Knopf nicht: Dort schwebte
 * er über Texten und Buttons. Stattdessen sitzt der Chat in einer festen
 * Leiste unten – neben „Anrufen“ und „Termin“, den beiden Wegen, die auf
 * dem Telefon am häufigsten gesucht werden. Beide Auslöser steuern
 * dasselbe Fenster; die Leiste lebt in #site-chat, damit sie bei offenem
 * Menü mit inert geschaltet wird.
 */

const ChatWindow = dynamic(() => import("@/components/chat/ChatWindow").then((m) => m.ChatWindow), { ssr: false });

type Availability = "unknown" | "checking" | "on" | "off";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<ChatLang>("de");
  const [availability, setAvailability] = useState<Availability>("unknown");
  /** Mikrofon nur, wenn das Cockpit einen Sprachanbieter hat. */
  const [voice, setVoice] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const barLauncher = useRef<HTMLButtonElement>(null);
  /** Welcher Auslöser zuletzt geöffnet hat – dorthin kehrt der Fokus zurück. */
  const opener = useRef<HTMLButtonElement | null>(null);
  const asked = useRef(false);
  const copy = chatCopy[lang];

  /**
   * Beim ersten Öffnen einmal nachsehen, ob die Praxis den Chat anbietet.
   *
   * Absichtlich mit einem Ref statt mit `availability` in den
   * Abhängigkeiten: Sonst löst `setAvailability("checking")` den Effekt
   * erneut aus, dessen Aufräumen die noch laufende Antwort verwirft – der
   * Schalter der Praxis käme nie an. Ein Abbruch ist auch nicht nötig,
   * denn dieser Knopf bleibt stehen, solange die Seite lebt.
   */
  useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    if (!site.cockpitApiUrl) {
      setAvailability("off");
      return;
    }
    setAvailability("checking");
    void fetchCockpitStatus(site.cockpitApiUrl).then((status) => {
      setAvailability(status?.chatEnabled ? "on" : "off");
      setVoice(status?.voice === true);
    });
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    // Fokus zurück an den Knopf, von dem aus geöffnet wurde
    window.setTimeout(() => (opener.current ?? launcher.current)?.focus(), 0);
  }, []);

  return (
    <div id="site-chat" className="print:hidden">
      <button
        ref={launcher}
        type="button"
        onClick={() => {
          opener.current = launcher.current;
          setOpen((v) => !v);
        }}
        aria-label={open ? copy.launcherClose : copy.launcherOpen}
        aria-expanded={open}
        aria-controls="site-chat-window"
        className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-cream shadow-lg transition hover:bg-primary-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-md:hidden sm:bottom-6 sm:right-6"
      >
        <Icon name={open ? "close" : "chat"} size={24} />
      </button>

      <nav
        aria-label={mobileBar.label}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/97 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_-24px_rgba(23,37,27,0.45)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-[1fr_1.4fr_1fr] items-center gap-2 px-3">
          <a
            href={site.phoneHref}
            aria-label={copy.callLabel}
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-ink/80 active:bg-ink/5"
          >
            <Icon name="phone" size={20} className="text-primary-deep" />
            {mobileBar.call}
          </a>
          <a
            href={ctaHref}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-deep active:bg-[#76a81f]"
          >
            <Icon name="calendar" size={18} />
            {mobileBar.termin}
          </a>
          <button
            ref={barLauncher}
            type="button"
            onClick={() => {
              opener.current = barLauncher.current;
              setOpen((v) => !v);
            }}
            aria-label={open ? copy.launcherClose : copy.launcherOpen}
            aria-expanded={open}
            aria-controls="site-chat-window"
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-ink/80 active:bg-ink/5"
          >
            <Icon name={open ? "close" : "chat"} size={20} className="text-primary-deep" />
            {mobileBar.chat}
          </button>
        </div>
      </nav>

      {open && (
        <ChatWindow
          lang={lang}
          onLang={setLang}
          onClose={close}
          available={availability === "on"}
          voice={voice}
          checking={availability === "checking" || availability === "unknown"}
          hours={hoursLine(lang)}
        />
      )}
    </div>
  );
}
