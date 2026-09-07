"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatCopy, hoursLine, type ChatLang } from "@/content/chat";
import { site } from "@/content/site";
import { fetchCockpitStatus } from "@/lib/booking/status";
import { Icon } from "@/components/ui/Icon";

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
 */

const ChatWindow = dynamic(() => import("@/components/chat/ChatWindow").then((m) => m.ChatWindow), { ssr: false });

type Availability = "unknown" | "checking" | "on" | "off";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<ChatLang>("de");
  const [availability, setAvailability] = useState<Availability>("unknown");
  const launcher = useRef<HTMLButtonElement>(null);
  const copy = chatCopy[lang];

  // Beim ersten Öffnen einmal nachsehen, ob die Praxis den Chat anbietet.
  useEffect(() => {
    if (!open || availability !== "unknown") return;
    if (!site.cockpitApiUrl) {
      setAvailability("off");
      return;
    }
    let alive = true;
    setAvailability("checking");
    void fetchCockpitStatus(site.cockpitApiUrl).then((status) => {
      if (!alive) return;
      setAvailability(status?.chatEnabled ? "on" : "off");
    });
    return () => {
      alive = false;
    };
  }, [open, availability]);

  const close = useCallback(() => {
    setOpen(false);
    // Fokus zurück an den Knopf, von dem aus geöffnet wurde
    window.setTimeout(() => launcher.current?.focus(), 0);
  }, []);

  return (
    <div id="site-chat" className="print:hidden">
      <button
        ref={launcher}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? copy.launcherClose : copy.launcherOpen}
        aria-expanded={open}
        aria-controls="site-chat-window"
        className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-cream shadow-lg transition hover:bg-primary-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:bottom-6 sm:right-6"
      >
        <Icon name={open ? "close" : "chat"} size={24} />
      </button>

      {open && (
        <ChatWindow
          lang={lang}
          onLang={setLang}
          onClose={close}
          available={availability === "on"}
          checking={availability === "checking" || availability === "unknown"}
          hours={hoursLine(lang)}
        />
      )}
    </div>
  );
}
