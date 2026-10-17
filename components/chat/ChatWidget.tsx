"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { chatCopy, hoursLine, type ChatLang } from "@/content/chat";
import { site } from "@/content/site";
import { fetchCockpitStatus } from "@/lib/booking/status";
import { cn } from "@/lib/cn";
import { useLenis } from "@/providers/LenisProvider";
import { Icon } from "@/components/ui/Icon";
import { ChatOffline, ChatTitle, chatCloseClass, chatHeaderClass, chatWindowClass } from "@/components/chat/frame";
import type { ChatWindowProps } from "@/components/chat/ChatWindow";
import { ctaHref, mobileBar } from "@/content/navigation";

/**
 * Der Einstieg in den Chat: ein runder Knopf unten rechts.
 *
 * Zurückhaltend mit Absicht. Der Knopf ist immer da, aber er springt
 * niemanden an: keine automatisch aufpoppende Blase, kein roter Punkt,
 * keine Begrüßung, die man wegklicken muss. Wer ihn braucht, findet ihn.
 *
 * Das Fenster selbst wird nachgeladen – im Leerlauf nach dem Seitenaufbau
 * oder spätestens, sobald sich jemand einem Auslöser nähert (Zeiger,
 * Berührung, Fokus). Bis es da ist, steht nach dem Tippen SOFORT ein Rahmen
 * mit Titel und „Einen Moment …“: Auf langsamen Verbindungen sah man
 * vorher bis zu fünf Sekunden lang nichts und tippte noch einmal – und
 * schloss das Fenster damit wieder. Ob es überhaupt ein Fenster gibt,
 * entscheidet die Praxis: Beim ersten Öffnen wird der Zustand des Cockpits
 * abgefragt; ohne Cockpit-Adresse, ohne Antwort oder mit abgeschaltetem
 * Chat zeigt das Fenster nur Telefonnummer und Sprechzeiten.
 *
 * Auf dem Handy (unter md) gibt es den runden Knopf nicht: Dort schwebte
 * er über Texten und Buttons. Stattdessen sitzt der Chat in einer festen
 * Leiste unten – neben „Anrufen“ und „Termin“, den beiden Wegen, die auf
 * dem Telefon am häufigsten gesucht werden. Beide Auslöser steuern
 * dasselbe Fenster; die Leiste lebt in #site-chat, damit sie bei offenem
 * Menü mit inert geschaltet wird. Unter `sm` füllt das Fenster den
 * unteren Schirm und ist ein echter Dialog: Seite abgedunkelt und
 * gesperrt, Tippen daneben schließt.
 */

type ChatWindowComponent = ComponentType<ChatWindowProps>;

/** Das Fenster wird höchstens einmal geladen; nach einem Fehlschlag darf es erneut versucht werden. */
let windowModule: Promise<ChatWindowComponent> | null = null;
function loadWindow(): Promise<ChatWindowComponent> {
  if (!windowModule) {
    windowModule = import("@/components/chat/ChatWindow").then((m) => m.ChatWindow);
    windowModule.catch(() => {
      windowModule = null;
    });
  }
  return windowModule;
}

/** Ab hier ist das Fenster ein Dialog über der ganzen Seite (wie seine Breite: `sm:`). */
const MODAL_QUERY = "(max-width: 639px)";
/** Nach dieser Zeit sagt der Rahmen ehrlich, dass es länger dauert. */
const SLOW_MS = 4000;

function subscribeModal(onChange: () => void) {
  const query = window.matchMedia(MODAL_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type Availability = "unknown" | "checking" | "on" | "off";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<ChatLang>("de");
  const [availability, setAvailability] = useState<Availability>("unknown");
  /** Mikrofon nur, wenn das Cockpit einen Sprachanbieter hat. */
  const [voice, setVoice] = useState(false);
  const [ChatWindow, setChatWindow] = useState<ChatWindowComponent | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const modal = useSyncExternalStore(
    subscribeModal,
    () => window.matchMedia(MODAL_QUERY).matches,
    () => false,
  );
  const launcher = useRef<HTMLButtonElement>(null);
  const barLauncher = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  /** Welcher Auslöser zuletzt geöffnet hat – dorthin kehrt der Fokus zurück. */
  const opener = useRef<HTMLButtonElement | null>(null);
  const asked = useRef(false);
  const copy = chatCopy[lang];
  const { stop, start } = useLenis();

  const preload = useCallback(() => {
    loadWindow().then(
      (component) => {
        setLoadFailed(false);
        setChatWindow(() => component);
      },
      () => setLoadFailed(true),
    );
  }, []);

  // Im Leerlauf nach dem Laden vorladen – nicht im Datensparmodus und nicht
  // auf sehr langsamen Verbindungen; dort lädt erst die Annäherung.
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /2g/.test(connection?.effectiveType ?? "")) return;
    let idle = 0;
    let timer = 0;
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(preload, { timeout: 8000 });
      else timer = window.setTimeout(preload, 3000);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [preload]);

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
    if (!open) return;
    preload();
    if (asked.current) return;
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
  }, [open, preload]);

  // Ist die Buchungskarte im Bild, tritt „Termin“ in der Leiste zurück: Der
  // Weg ist schon da, und pro Ansicht handelt nur ein Grün.
  const [bookingInView, setBookingInView] = useState(false);
  useEffect(() => {
    const card = document.querySelector("[data-booking-card]");
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => setBookingInView(Boolean(entry?.isIntersecting)), {
      threshold: 0.15,
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Fokus zurück an den Knopf, von dem aus geöffnet wurde
    window.setTimeout(() => (opener.current ?? launcher.current)?.focus(), 0);
  }, []);

  // Escape schließt – wie das Menü im Kopfbereich, auch solange das Fenster lädt.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Handy: Dialog über der Seite. Die Seite dahinter scrollt nicht mit und
  // ist für Tastatur und Vorlesehilfe stumm; der Fokus landet im Dialog,
  // ohne die Tastatur aufzuziehen (die verdeckte sonst die halbe Antwort).
  useEffect(() => {
    if (!open || !modal) return;
    const background = [
      document.getElementById("site-header"),
      document.getElementById("main"),
      document.getElementById("site-footer"),
      bar.current,
    ].filter((el): el is HTMLElement => el !== null);
    background.forEach((el) => (el.inert = true));
    document.documentElement.style.overflow = "hidden";
    stop();
    const raf = requestAnimationFrame(() => dialog.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(raf);
      background.forEach((el) => (el.inert = false));
      document.documentElement.style.overflow = "";
      start();
    };
  }, [open, modal, stop, start]);

  return (
    <div id="site-chat" className="print:hidden">
      <button
        ref={launcher}
        type="button"
        onClick={() => {
          opener.current = launcher.current;
          setOpen((v) => !v);
        }}
        onPointerEnter={preload}
        onFocus={preload}
        aria-label={open ? copy.launcherClose : copy.launcherOpen}
        aria-expanded={open}
        aria-controls="site-chat-window"
        className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-cream shadow-lg transition hover:bg-primary-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-md:hidden sm:bottom-6 sm:right-6"
      >
        <Icon name={open ? "close" : "chat"} size={24} />
      </button>

      <nav
        ref={bar}
        aria-label={mobileBar.label}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/97 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_-24px_rgba(23,37,27,0.45)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-[1fr_1.4fr_1fr] items-center gap-2 px-3">
          <a
            href={site.phoneHref}
            aria-label={copy.callLabel}
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium text-ink/80 active:bg-ink/5"
          >
            <Icon name="phone" size={20} className="text-primary-deep" />
            {mobileBar.call}
          </a>
          <a
            href={ctaHref}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-300",
              bookingInView
                ? "border-ink/15 text-ink/80 active:bg-ink/5"
                : "border-transparent bg-accent text-deep active:bg-[#76a81f]",
            )}
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
            onTouchStart={preload}
            onPointerEnter={preload}
            onFocus={preload}
            aria-label={open ? copy.launcherClose : copy.launcherOpen}
            aria-expanded={open}
            aria-controls="site-chat-window"
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium text-ink/80 active:bg-ink/5"
          >
            <Icon name={open ? "close" : "chat"} size={20} className="text-primary-deep" />
            {mobileBar.chat}
          </button>
        </div>
      </nav>

      {open && (
        <>
          {/* Handy: abgedunkelte Seite – Tippen daneben schließt */}
          <div aria-hidden="true" onClick={close} className="fixed inset-0 z-[59] bg-deep/40 sm:hidden" />
          {/* data-lenis-prevent: Verlauf, Formular und Textfeld scrollen selbst –
              Lenis würde Rad und Wischen sonst an die Seite weiterreichen. */}
          <div
            ref={dialog}
            id="site-chat-window"
            role="dialog"
            aria-modal={modal || undefined}
            aria-label={`${copy.windowTitle} · ${copy.windowSubtitle}`}
            aria-busy={!ChatWindow && !loadFailed ? true : undefined}
            lang={lang}
            tabIndex={-1}
            data-lenis-prevent
            className={cn(chatWindowClass, !ChatWindow && "max-sm:min-h-[22rem]")}
          >
            {ChatWindow ? (
              <ChatWindow
                lang={lang}
                onLang={setLang}
                onClose={close}
                available={availability === "on"}
                voice={voice}
                checking={availability === "checking" || availability === "unknown"}
                hours={hoursLine(lang)}
              />
            ) : (
              <ChatLoading lang={lang} failed={loadFailed} onClose={close} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Steht sofort, solange das Fenster lädt – damit niemand ein zweites Mal tippt. */
function ChatLoading({ lang, failed, onClose }: { lang: ChatLang; failed: boolean; onClose: () => void }) {
  const copy = chatCopy[lang];
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <>
      <div className={chatHeaderClass}>
        <ChatTitle lang={lang} />
        <button type="button" onClick={onClose} aria-label={copy.close} className={chatCloseClass}>
          <Icon name="close" size={18} />
        </button>
      </div>
      {failed ? (
        <ChatOffline lang={lang} hours={hoursLine(lang)} />
      ) : (
        <p role="status" className="flex-1 px-4 py-6 text-sm text-ink/70">
          {slow ? copy.slow : copy.loading}
        </p>
      )}
    </>
  );
}
