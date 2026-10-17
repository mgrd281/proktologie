"use client";

import { AppointmentBookingDialog } from "@/components/booking/dialog/AppointmentBookingDialog";
import { OPEN_BOOKING_ATTR } from "@/lib/booking/openers";
import { useBookingFlow, type BookingFlow } from "@/lib/booking/useBookingFlow";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Der Termin-Dialog für die ganze Website: ein Zustand, ein Dialog.
 *
 * Termin-Knöpfe (`data-open-booking`, siehe lib/booking/openers.ts) öffnen ihn
 * per Klick; der Klick wird in der Capture-Phase abgefangen, bevor der
 * Anker-Handler im LenisProvider zur Sektion fährt – die Seite bleibt exakt,
 * wo sie war. Der Entwurf lebt hier und bleibt nach dem Schließen erhalten
 * (bis zum Neuladen); nach einer erfolgreichen Buchung beginnt das nächste
 * Öffnen neu.
 *
 * Zurück-Geste (Handy) und Zurück-Knopf des Browsers: Solange der Dialog offen
 * ist, liegt genau EIN eigener Verlaufseintrag obenauf (ohne Adressänderung –
 * Next.js lädt dabei nichts neu). Zurück geht einen Schritt zurück und legt
 * den Eintrag neu an; im ersten Schritt oder nach dem Abschluss schließt
 * Zurück den Dialog. Schließen per Knopf oder Esc nimmt den Eintrag wieder weg.
 */

interface BookingDialogContextValue {
  /** Öffnet den Dialog; `opener` bekommt beim Schließen den Fokus zurück. */
  openBooking: (opener?: HTMLElement | null) => void;
  closeBooking: () => void;
  isOpen: boolean;
  flow: BookingFlow;
}

const BookingDialogContext = createContext<BookingDialogContextValue | null>(null);

export function useBookingDialog(): BookingDialogContextValue {
  const ctx = useContext(BookingDialogContext);
  if (!ctx) throw new Error("useBookingDialog must be used within BookingDialogProvider");
  return ctx;
}

/** Verlaufseintrag des Dialogs – Next.js ergänzt seine eigenen Felder. */
const isBookingEntry = (state: unknown) => Boolean((state as { booking?: unknown } | null)?.booking);

export function BookingDialogProvider({ children }: { children: ReactNode }) {
  const flow = useBookingFlow();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  /** Liegt unser Verlaufseintrag gerade obenauf? */
  const onTop = useRef(false);
  /** Das nächste popstate kommt von uns selbst (Schließen per Knopf). */
  const ownBack = useRef(false);
  const openRef = useRef(open);
  const flowRef = useRef(flow);
  useEffect(() => {
    openRef.current = open;
    flowRef.current = flow;
  });

  const { prepare, reset } = flow;
  const openBooking = useCallback(
    (from?: HTMLElement | null) => {
      if (openRef.current) return;
      opener.current = from ?? (document.activeElement as HTMLElement | null);
      prepare();
      // Nach einer Buchung beginnt der nächste Termin von vorn
      if (flowRef.current.send.kind === "done") reset();
      openRef.current = true;
      setOpen(true);
      if (!isBookingEntry(window.history.state)) window.history.pushState({ booking: true }, "");
      onTop.current = true;
    },
    [prepare, reset],
  );

  const closeBooking = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    if (onTop.current && isBookingEntry(window.history.state)) {
      ownBack.current = true;
      onTop.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      if (ownBack.current) {
        ownBack.current = false;
        // Next.js nimmt beim Zurück den Fokus weg – war er schon wieder beim
        // Öffner, kommt er dorthin zurück
        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== document.body) {
          window.setTimeout(() => {
            if (document.activeElement === document.body && active.isConnected) active.focus({ preventScroll: true });
          }, 50);
        }
        return;
      }
      const left = onTop.current && !isBookingEntry(event.state);
      onTop.current = isBookingEntry(event.state);
      if (!left || !openRef.current) return;
      const { step, send, back } = flowRef.current;
      // Während gebucht wird, bleibt der Dialog stehen
      const stay = send.kind === "sending" || (step > 0 && send.kind !== "done");
      if (stay) {
        if (send.kind !== "sending") back();
        window.history.pushState({ booking: true }, "");
        onTop.current = true;
        return;
      }
      openRef.current = false;
      setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Termin-Knöpfe: vor allen anderen Klick-Handlern abfangen. Strg-, Shift- und
  // Mittelklick öffnen wie gewohnt die Sektion in einem neuen Tab.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = (event.target as Element | null)?.closest?.(`[${OPEN_BOOKING_ATTR}]`);
      if (!(target instanceof HTMLElement)) return;
      event.preventDefault();
      openBooking(target);
    };
    // Nähert sich jemand einem Termin-Knopf, lädt die Verfügbarkeit schon
    const onNear = (event: Event) => {
      if ((event.target as Element | null)?.closest?.(`[${OPEN_BOOKING_ATTR}]`)) prepare();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerover", onNear, { passive: true });
    document.addEventListener("touchstart", onNear, { passive: true });
    document.addEventListener("focusin", onNear);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerover", onNear);
      document.removeEventListener("touchstart", onNear);
      document.removeEventListener("focusin", onNear);
    };
  }, [openBooking, prepare]);

  const value = useMemo(
    () => ({ openBooking, closeBooking, isOpen: open, flow }),
    [openBooking, closeBooking, open, flow],
  );

  return (
    <BookingDialogContext.Provider value={value}>
      {children}
      <AppointmentBookingDialog open={open} flow={flow} opener={opener} onClose={closeBooking} />
    </BookingDialogContext.Provider>
  );
}
