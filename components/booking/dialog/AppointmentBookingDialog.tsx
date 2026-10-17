"use client";

import { BookingDialogHeader } from "@/components/booking/dialog/BookingDialogHeader";
import { BookingNavigation } from "@/components/booking/dialog/BookingNavigation";
import { BookingSuccess } from "@/components/booking/dialog/BookingSuccess";
import { useSheetDrag } from "@/components/booking/dialog/useSheetDrag";
import { LoadError } from "@/components/booking/LoadError";
import { StepCalendar } from "@/components/booking/StepCalendar";
import { StepConfirm } from "@/components/booking/StepConfirm";
import { StepDetails } from "@/components/booking/StepDetails";
import { StepFrame } from "@/components/booking/StepFrame";
import { StepSlots } from "@/components/booking/StepSlots";
import { StepTypes } from "@/components/booking/StepTypes";
import { Icon } from "@/components/ui/Icon";
import { appointmentTypes, bookingCopy, bookingDialog, bookingSteps } from "@/content/booking";
import { site } from "@/content/site";
import type { BookingFlow } from "@/lib/booking/useBookingFlow";
import { STEP_COUNT } from "@/lib/booking/useBookingFlow";
import { cn } from "@/lib/cn";
import { useLenis } from "@/providers/LenisProvider";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  LazyMotion,
  m,
  useIsPresent,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Der Termin-Dialog – über der Seite, die exakt an ihrer Stelle bleibt.
 *
 * Handy (unter md): ein Bottom-Sheet wie in Apps. Die Seite bleibt oben
 * abgedunkelt sichtbar (Streifen von mindestens 48 px), das Sheet kommt von
 * unten, mit runden oberen Ecken und einem Griff. Es ist so hoch wie sein
 * Inhalt – beim Schrittwechsel gleitet die Oberkante mit (StepFrame) – und
 * höchstens bis zum Streifen; dann scrollt nur der Inhalt. Schließen: Griff
 * nach unten ziehen, auf den Streifen tippen, Schließen-Knopf, Esc oder
 * Zurück-Geste. Öffnet sich die Tastatur, folgt das Sheet dem sichtbaren
 * Bereich (visualViewport) – der Fuß bleibt über der Tastatur.
 * Ab md: zentriert, höchstens 640 px breit und 90 % der Höhe, dieselbe
 * Formensprache; ein Klick daneben schließt (nur wenn Drücken UND Loslassen
 * daneben waren – kein Schließen beim Markieren von Text).
 *
 * Zugänglich: role="dialog" mit aria-modal, Name aus dem Kopf, Fokusfalle,
 * Esc schließt, der Fokus geht auf die Überschrift des Schritts (mit
 * „Schritt 2 von 5“ für Screenreader) und nach dem Schließen zurück zum
 * Knopf, der geöffnet hat. Alles hinter dem Dialog ist `inert`, die Seite
 * scrollt nicht mit (Lenis gestoppt, overflow gesperrt, Scrollleisten-Platz
 * bleibt – nichts verrutscht).
 *
 * Bewegung (MOTION_SYSTEM.md): Handy 320 ms von unten herein (ganze Höhe),
 * 220 ms hinaus – nach dem Ziehen von dort, wo der Finger losließ; Desktop
 * 240 ms mit 12 px, 180 ms hinaus; Schrittwechsel über StepFrame;
 * reduzierte Bewegung → sofort.
 */

const EASE_OUT_SOFT = [0.22, 1, 0.36, 1] as const;
const loadFeatures = () => import("@/lib/motionFeatures").then((mod) => mod.default);

const DESKTOP_QUERY = "(min-width: 48rem)";
function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Alles, was in der Fokusfalle den Fokus bekommen kann. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface AppointmentBookingDialogProps {
  open: boolean;
  flow: BookingFlow;
  /** Der Knopf, der geöffnet hat – dorthin kehrt der Fokus zurück */
  opener: RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function AppointmentBookingDialog(props: AppointmentBookingDialogProps) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <AnimatePresence>{props.open && <DialogLayer key="booking-dialog" {...props} />}</AnimatePresence>
    </LazyMotion>
  );
}

function DialogLayer({ flow, opener, onClose }: AppointmentBookingDialogProps) {
  const reduced = useReducedMotion() ?? false;
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
  const isPresent = useIsPresent();
  const root = useRef<HTMLDivElement>(null);
  // Die Fläche des Sheets: folgt beim Ziehen dem Finger (nur Handy) und ist
  // der Rahmen der Fokusfalle
  const { ref: panel, handlers: dragHandlers, reset: resetDrag } = useSheetDrag<HTMLDivElement>(!desktop, onClose);
  const content = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const formId = useId();
  const { stop, start, scrollTo } = useLenis();
  const router = useRouter();
  /** „Weiter“ ohne Wahl angetippt – in diesem Schritt: dann steht daneben, was fehlt */
  const [hintStep, setHintStep] = useState<number | null>(null);
  /** Tippen auf den Streifen (bzw. daneben): wo der Zeiger aufsetzte */
  const backdropPress = useRef<{ id: number; x: number; y: number } | null>(null);
  /** Was nach dem Schließen statt „Fokus zum Öffner“ passieren soll (etwa „Anfahrt“) */
  const afterClose = useRef<(() => void) | null>(null);
  const topEdge = useRef<HTMLDivElement>(null);
  const bottomEdge = useRef<HTMLDivElement>(null);
  // Die Tastatur am Handy: sichtbare Höhe und Versatz (sonst die volle Höhe)
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);

  const { step, send, provider, mode, modePending } = flow;
  const done = send.kind === "done";
  const sending = send.kind === "sending";

  // Beim Schrittwechsel gleitet der alte Schritt noch kurz hinaus; verschwindet
  // er, würde ein gewöhnlicher Ref auf null fallen – obwohl der neue längst steht.
  const setHeading = useCallback((el: HTMLHeadingElement | null) => {
    if (el) headingRef.current = el;
  }, []);

  // Hintergrund stumm und fest – solange der Dialog da ist. Beim Schließen
  // kehrt der Fokus zum Öffner zurück, ohne die Seite zu verschieben.
  useEffect(() => {
    const own = root.current;
    const html = document.documentElement;
    const silenced = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== own && !el.contains(own) && !el.inert,
    );
    silenced.forEach((el) => (el.inert = true));
    const overflow = html.style.overflow;
    const gutter = html.style.scrollbarGutter;
    const overscroll = html.style.overscrollBehavior;
    // Platz der Scrollleiste behalten: Sonst rückte die Seite am Desktop zur Seite.
    // Nur, wo die Leiste Platz belegt – schwebende Leisten (Handy, macOS) brauchen keinen.
    if (window.innerWidth - html.clientWidth > 0) html.style.scrollbarGutter = "stable";
    html.style.overflow = "hidden";
    // iOS: kein Nachfedern der Seite hinter dem Sheet
    html.style.overscrollBehavior = "none";
    stop();
    const openerEl = opener.current;
    return () => {
      silenced.forEach((el) => (el.inert = false));
      html.style.overflow = overflow;
      html.style.scrollbarGutter = gutter;
      html.style.overscrollBehavior = overscroll;
      start();
      const action = afterClose.current;
      if (action) {
        // Erst wenn das Zurück im Verlauf durch ist – sonst stellt Next.js die
        // alte Scrollposition wieder her und die Fahrt zur Praxis verpufft
        const run = () => window.setTimeout(action, 50);
        if ((window.history.state as { booking?: unknown } | null)?.booking) {
          const fallback = window.setTimeout(action, 400);
          window.addEventListener(
            "popstate",
            () => {
              window.clearTimeout(fallback);
              run();
            },
            { once: true },
          );
        } else run();
        return;
      }
      // Öffner weg (etwa der Knopf im Handy-Menü)? Dann der Menü-Knopf
      const visible = (el: HTMLElement | null) => el && el.isConnected && el.getClientRects().length > 0;
      const target = visible(openerEl)
        ? openerEl
        : document.querySelector<HTMLElement>('#site-header [aria-controls="mobile-menu"]');
      if (visible(target)) target!.focus({ preventScroll: true });
    };
  }, [opener, stop, start]);

  // Fokus: beim Öffnen und bei jedem Schritt auf die Überschrift, nach dem
  // Abschluss auf dessen Überschrift. Der Inhalt beginnt wieder oben.
  useEffect(() => {
    if (send.kind === "sending" || send.kind === "error") return;
    const frame = requestAnimationFrame(() => {
      content.current?.scrollTo({ top: 0 });
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [step, send.kind]);

  // Scheitert das Absenden, rückt die Meldung ins Bild (der Fokus bleibt am Knopf)
  useEffect(() => {
    if (send.kind === "error" && errorRef.current) revealInside(content.current, errorRef.current);
  }, [send.kind]);

  // Sobald gewählt ist (oder der Schritt wechselt), verschwindet der Hinweis
  const ready = flow.complete[step] ?? true;
  const hint = !done && !ready && hintStep === step ? (bookingDialog.required[step] ?? null) : null;

  // Handy-Tastatur: dem sichtbaren Bereich folgen
  useEffect(() => {
    const vv = window.visualViewport;
    if (desktop || !vv) return;
    const update = () => {
      // Hineingezoomt (zwei Finger) ist keine Tastatur – das Sheet bleibt, wie es ist
      if (vv.scale > 1.01) return;
      const covered = window.innerHeight - vv.height > 80;
      setViewport(covered ? { height: vv.height, top: vv.offsetTop } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [desktop]);

  // Ist der Dialog für die Tastatur geschrumpft: das Feld mit dem Fokus sichtbar halten
  useEffect(() => {
    if (!viewport) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && content.current?.contains(active)) revealInside(content.current, active);
    });
    return () => cancelAnimationFrame(frame);
  }, [viewport]);

  // Ziehen zum Schließen (nur Handy); öffnet das Sheet wieder, während es noch
  // hinausfährt, steht es wieder an seinem Platz
  useEffect(() => {
    if (isPresent) resetDrag();
  }, [isPresent, resetDrag]);

  // Trennlinien nur bei Bedarf: unter dem Kopf, sobald der Inhalt gescrollt
  // ist; über dem Fuß, solange noch Inhalt folgt. Zwei 1-px-Marker im Inhalt,
  // Attribute am Sheet – ohne neues Rendern.
  useEffect(() => {
    const box = content.current;
    const sheet = panel.current;
    const top = topEdge.current;
    const bottom = bottomEdge.current;
    if (!box || !sheet || !top || !bottom) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          sheet.toggleAttribute(entry.target === top ? "data-scrolled" : "data-more", !entry.isIntersecting);
        }
      },
      { root: box },
    );
    observer.observe(top);
    observer.observe(bottom);
    return () => observer.disconnect();
  }, [panel]);

  // Esc schließt; Tab bleibt im Dialog. Am Dokument statt am Dialog: Auch wenn
  // der Fokus kurz auf <body> fällt (der geklickte Knopf wurde ersetzt), greift beides.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const box = panel.current;
      if (!box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest("[inert]") && el.getClientRects().length > 0,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!(active instanceof Node) || !box.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panel]);

  // Richtung für die Bewegung (StepFrame): Weiter = +1, Zurück und „Ändern“ = −1.
  const paneIndex = done ? STEP_COUNT : step;
  const [lastPane, setLastPane] = useState(paneIndex);
  const [direction, setDirection] = useState(1);
  if (paneIndex !== lastPane) {
    setDirection(paneIndex > lastPane ? 1 : -1);
    setLastPane(paneIndex);
  }

  const confirmed = mode === "confirmed";
  const title =
    (provider ? confirmed : site.bookingProvider === "cockpit") ? bookingDialog.title : bookingDialog.titleRequest;

  const primary = (() => {
    if (done) return { label: bookingDialog.close, onClick: onClose, arrow: false };
    if (step === 3) return { label: bookingDialog.next, formId, arrow: true };
    if (step === 4)
      return {
        label: confirmed ? bookingCopy.confirm.submitConfirmed : bookingCopy.confirm.submitRequest,
        loadingLabel: confirmed ? bookingCopy.confirm.sendingConfirmed : bookingCopy.confirm.sendingRequest,
        onClick: () => void flow.submit(),
        // Der letzte Schritt führt nicht „weiter“ – er bucht: ohne Pfeil
        arrow: false,
      };
    return {
      label: bookingDialog.next,
      onClick: () => (ready ? flow.next() : setHintStep(step)),
      arrow: true,
    };
  })();

  const transition = (duration: number): Transition => ({
    duration: reduced ? 0 : duration,
    ease: EASE_OUT_SOFT,
  });

  return (
    <div
      ref={root}
      inert={!isPresent}
      className="fixed inset-0 z-[70] flex flex-col justify-end pt-[max(3rem,env(safe-area-inset-top)_+_1rem)] md:items-center md:justify-center md:p-6"
      style={!desktop && viewport ? { top: viewport.top, bottom: "auto", height: viewport.height } : undefined}
    >
      {/* Abgedunkelte Seite: Tippen darauf schließt (auch am Handy, oben im Streifen) */}
      <m.div
        aria-hidden="true"
        data-booking-backdrop
        className="absolute inset-0 touch-none bg-deep/40 md:backdrop-blur-[2px]"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1, transition: transition(desktop ? 0.24 : 0.32) }}
        exit={{ opacity: 0, transition: transition(desktop ? 0.18 : 0.22) }}
        onPointerDown={(event) => {
          backdropPress.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        // Erst beim click schließen (nicht schon beim Loslassen): Sonst träfe der
        // click desselben Tippens die Seite, die dann schon wieder bedienbar ist.
        // React hängt an Elemente mit onClick den Leer-Handler, den iOS dafür braucht.
        onClick={(event) => {
          const press = backdropPress.current;
          backdropPress.current = null;
          if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) < 10) onClose();
        }}
        onPointerCancel={() => {
          backdropPress.current = null;
        }}
      />
      <m.div
        className="relative flex max-h-full min-h-0 w-full flex-col md:max-h-[min(90dvh,820px)] md:max-w-[640px]"
        initial={reduced ? false : desktop ? { opacity: 0, y: 12 } : { y: "100%" }}
        animate={
          desktop ? { opacity: 1, y: 0, transition: transition(0.24) } : { y: "0%", transition: transition(0.32) }
        }
        exit={
          desktop ? { opacity: 0, y: 12, transition: transition(0.18) } : { y: "100%", transition: transition(0.22) }
        }
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={sending || undefined}
          className="group/sheet flex min-h-0 flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-16px_40px_-20px_rgba(23,37,27,0.35)] md:rounded-3xl md:shadow-[0_30px_80px_-30px_rgba(23,37,27,0.45)]"
        >
          <BookingDialogHeader
            titleId={titleId}
            title={title}
            step={step}
            done={done}
            onClose={onClose}
            dragHandlers={desktop ? undefined : dragHandlers}
          />

          <div
            ref={content}
            data-lenis-prevent
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div ref={topEdge} aria-hidden="true" className="-mb-px h-px" />
            <StepFrame paneKey={paneIndex} direction={direction} className="px-5 pt-2 pb-6 md:px-8 md:pt-3 md:pb-7">
            {done ? (
              <BookingSuccess
                send={send}
                headingRef={setHeading}
                calendarSaved={flow.calendarSaved}
                onCalendarSaved={() => flow.setCalendarSaved(true)}
                onAgain={flow.reset}
                onDirections={() => {
                  // Erst wenn der Dialog zu ist und die Seite wieder scrollt, zur Praxis –
                  // ausgeführt beim Aushängen, statt den Fokus zum Öffner zu schicken
                  afterClose.current = () => {
                    const target = document.getElementById("praxis");
                    if (!target) {
                      router.push("/#praxis");
                      return;
                    }
                    const far = Math.abs(target.getBoundingClientRect().top) > window.innerHeight * 2;
                    scrollTo(target, 0, far);
                    if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
                    target.focus({ preventScroll: true });
                  };
                  onClose();
                }}
              />
            ) : (
              <StepBody
                flow={flow}
                headingRef={setHeading}
                formId={formId}
                errorRef={errorRef}
                modePending={modePending}
              />
            )}
            </StepFrame>
            <div ref={bottomEdge} aria-hidden="true" className="-mt-px h-px" />
          </div>

          <BookingNavigation
          canGoBack={!done && step > 0}
          backLabel={bookingDialog.back}
          onBack={flow.back}
          primaryLabel={primary.label}
          ready={done || step >= 3 || ready}
          onPrimary={primary.onClick}
          formId={primary.formId}
          loading={step === 4 && sending}
          loadingLabel={primary.loadingLabel}
          withArrow={primary.arrow}
          hint={hint}
          />
        </div>
      </m.div>
    </div>
  );
}

interface StepBodyProps {
  flow: BookingFlow;
  headingRef: (el: HTMLHeadingElement | null) => void;
  formId: string;
  errorRef: RefObject<HTMLDivElement | null>;
  modePending: boolean;
}

/** Überschrift, Beschreibung und Inhalt des aktuellen Schritts. */
function StepBody({ flow, headingRef, formId, errorRef, modePending }: StepBodyProps) {
  const { step, draft, provider, providerFailed, mode, send, slots } = flow;
  const meta = bookingSteps[step];
  const confirmed = mode === "confirmed";

  let body: ReactNode = null;
  if (step === 0) {
    body = (
      <>
        <StepTypes types={appointmentTypes} selected={draft.typeId} onSelect={flow.selectType} />
        {/* Was hier passiert – verbindlich oder Anfrage. Bis das Cockpit
            geantwortet hat, bleibt der Platz frei statt kurz das falsche Wort. */}
        <p className={cn("mt-5 text-xs leading-relaxed text-ink/70", modePending && "invisible")}>
          {confirmed ? bookingCopy.confirmedModeNote : bookingCopy.requestModeNote}
        </p>
      </>
    );
  } else if (step === 1) {
    body = provider ? (
      <StepCalendar provider={provider} typeId={draft.typeId} selected={draft.date} onSelect={flow.selectDate} />
    ) : providerFailed ? (
      <LoadError onRetry={flow.retryProvider} />
    ) : (
      <p role="status" className="text-sm text-ink/70">
        {bookingDialog.loadingCalendar}
      </p>
    );
  } else if (step === 2) {
    body =
      !slots || slots.status === "loading" ? (
        <p role="status" className="text-sm text-ink/70">
          {bookingDialog.loadingSlots}
        </p>
      ) : slots.status === "failed" ? (
        <LoadError onRetry={() => draft.date && flow.loadSlots(draft.date, draft.typeId)} />
      ) : (
        <StepSlots
          slots={slots.slots}
          selected={draft.slotId}
          dateLabel={dateLabel(draft.date)}
          mode={mode}
          onSelect={flow.selectSlot}
        />
      );
  } else if (step === 3) {
    body = <StepDetails formId={formId} draft={draft} onChange={flow.patchDraft} onContinue={flow.next} />;
  } else if (step === 4) {
    body = (
      <>
        <StepConfirm draft={draft} mode={mode} onEdit={flow.goTo} locked={send.kind === "sending"} />
        <p role="status" className="sr-only">
          {send.kind === "sending"
            ? confirmed
              ? bookingCopy.confirm.sendingConfirmed
              : bookingCopy.confirm.sendingRequest
            : ""}
        </p>
        {/* Fehler mit Ausweg: bei vergebener Zeit zurück zu den Zeiten
            desselben Tages, sonst das Telefon */}
        {send.kind === "error" && (
          <div
            ref={errorRef}
            role="alert"
            className="mt-5 rounded-2xl bg-mist/70 px-4 py-3 text-sm leading-relaxed"
          >
            <p className="font-medium text-red-800">{send.text}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-6">
              {send.code === "slot_taken" && draft.date && (
                <button
                  type="button"
                  onClick={flow.otherTime}
                  className="inline-flex min-h-11 items-center font-medium text-primary-deep underline underline-offset-4 hover:text-primary"
                >
                  {bookingCopy.confirm.otherTime}
                </button>
              )}
              <a
                href={site.phoneHref}
                className="inline-flex min-h-11 items-center gap-2 font-medium text-ink hover:text-primary-deep"
              >
                <Icon name="phone" size={16} className="text-primary-deep" />
                {site.phone}
              </a>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      <h3 ref={headingRef} tabIndex={-1} className="font-display text-2xl leading-tight font-medium text-ink outline-none! md:text-[1.75rem]">
        <span className="sr-only">{bookingDialog.stepOf(step + 1, STEP_COUNT)}: </span>
        {meta.title}
      </h3>
      {meta.description && <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{meta.description}</p>}

      {/* Die Praxis hat die Online-Buchung pausiert: ein ruhiger Satz, kein Alarm */}
      {provider?.notice && (
        <p
          role="note"
          className="mt-4 flex items-start gap-2 rounded-2xl bg-mist px-3.5 py-2.5 text-xs leading-relaxed text-ink/75"
        >
          <Icon name="phone" size={14} className="mt-0.5 shrink-0 text-primary" />
          <span>{provider.notice}</span>
        </p>
      )}

      <div className="mt-5">{body}</div>

      {/* Sofort verbindlicher Weg im Anfrage-Modus – nur mit echter Doctolib-Adresse */}
      {!confirmed && site.doctolibConfigured && step < 4 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-ink/8 pt-3">
          <p className="text-xs text-ink/70">{bookingCopy.doctolibHint}</p>
          <a
            href={site.doctolibUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {bookingCopy.confirm.doctolibCta}
            <Icon name="arrow-right" size={13} />
          </a>
        </div>
      )}
    </div>
  );
}

const slotDateFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function dateLabel(date: string | null): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return slotDateFormat.format(new Date(y, m - 1, d));
}

/**
 * Ein Element innerhalb des scrollenden Inhalts sichtbar machen – ohne
 * `scrollIntoView`, das auf iOS auch die gesperrte Seite dahinter verschiebt.
 */
function revealInside(box: HTMLElement | null, el: HTMLElement) {
  if (!box) return;
  const r = el.getBoundingClientRect();
  const c = box.getBoundingClientRect();
  const gap = 12;
  if (r.bottom > c.bottom - gap) box.scrollTop += r.bottom - c.bottom + gap;
  else if (r.top < c.top + gap) box.scrollTop -= c.top + gap - r.top;
}
