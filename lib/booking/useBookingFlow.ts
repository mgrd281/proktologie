"use client";

import { bookingCopy } from "@/content/booking";
import { site } from "@/content/site";
import type { BookingProvider } from "@/lib/booking/provider";
import { sharedBookingProvider } from "@/lib/booking/provider";
import type { BookingDraft, BookingSlot, ISODate } from "@/lib/booking/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Zustand der Terminbuchung – getrennt von der Oberfläche (dem Dialog), damit
 * Schließen nichts verliert: Der Entwurf lebt im Provider im Root-Layout und
 * bleibt bis zum Neuladen der Seite erhalten.
 *
 * Sämtliche Verfügbarkeit kommt über das BookingProvider-Interface – hier ist
 * nichts hartkodiert. Alle Daten bleiben clientseitig (kein localStorage,
 * keine URLs mit Personenbezug, kein Logging).
 *
 * Kein Schritt springt von selbst weiter: wählen, dann „Weiter“. Wer die
 * Terminart wechselt, wählt Tag und Uhrzeit neu (Verfügbarkeit gilt je
 * Terminart); wer den Tag wechselt, die Uhrzeit.
 */

export const emptyDraft: BookingDraft = {
  typeId: null,
  date: null,
  slotId: null,
  time: null,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  consent: false,
  website: "",
};

/** Antwort des Cockpits nach einer verbindlichen Buchung. */
export interface Booked {
  ref: string;
  startsAt: string;
  endsAt: string;
  calendarUid?: string;
}

export type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; method: "mailto" | "endpoint" }
  | { kind: "done"; method: "confirmed"; booked: Booked }
  | { kind: "error"; text: string; code?: string };

/** Die Zeiten eines Tages – geladen, ladend oder gescheitert. */
export interface SlotsState {
  date: ISODate;
  status: "loading" | "ready" | "failed";
  slots: BookingSlot[];
}

/** Anzahl der Schritte: Terminart, Tag, Uhrzeit, Angaben, Überblick. */
export const STEP_COUNT = 5;

export function useBookingFlow() {
  const [provider, setProvider] = useState<BookingProvider | null>(null);
  const [providerFailed, setProviderFailed] = useState(false);
  const [providerAttempt, setProviderAttempt] = useState(0);
  /** Erst laden, wenn jemand bucht oder der Browser Luft hat – nicht mitten im Seitenaufbau. */
  const [wanted, setWanted] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
  const [slots, setSlots] = useState<SlotsState | null>(null);
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  /** „In den Kalender“ geklickt – Hinweis, dass die Datei geladen ist */
  const [calendarSaved, setCalendarSaved] = useState(false);
  // Latest-wins: Eine ältere Antwort überschreibt nie die Zeiten des neu gewählten Tages.
  const slotsRequest = useRef(0);
  // Ein Doppelklick bucht nicht zweimal – auch nicht, bevor „Wird gebucht …“ steht.
  const sending = useRef(false);

  // Lädt der Code des Providers nicht (Netzstörung), zweimal neu versuchen –
  // danach sagt der Dialog es, mit „Erneut versuchen“ und Telefon.
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    let timer = 0;
    const load = (tries: number) => {
      sharedBookingProvider().then(
        (loaded) => {
          if (alive) setProvider(loaded);
        },
        () => {
          if (!alive) return;
          if (tries < 2) timer = window.setTimeout(() => load(tries + 1), 1500 * (tries + 1));
          else setProviderFailed(true);
        },
      );
    };
    load(0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [wanted, providerAttempt]);

  /** Provider vorbereiten – beim Öffnen und sobald sich jemand einem Termin-Knopf nähert. */
  const prepare = useCallback(() => setWanted(true), []);

  // Sonst, wenn der Browser Luft hat: Dann stehen Modus (Buchung oder Anfrage)
  // und freie Tage schon bereit, bevor jemand tippt. Derselbe Abruf wie die
  // Zeile „Freie Termine ab …“ – nichts wird doppelt geladen.
  useEffect(() => {
    const idle = typeof window.requestIdleCallback === "function";
    const handle = idle ? window.requestIdleCallback(prepare, { timeout: 2500 }) : window.setTimeout(prepare, 1200);
    return () => {
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [prepare]);

  const retryProvider = useCallback(() => {
    setProviderFailed(false);
    setProviderAttempt((a) => a + 1);
  }, []);

  const patchDraft = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const loadSlots = useCallback(
    (date: ISODate, typeId: string | null) => {
      if (!provider) return;
      const token = ++slotsRequest.current;
      setSlots({ date, status: "loading", slots: [] });
      provider.getAvailableSlots(date, typeId).then(
        (result) => {
          if (token === slotsRequest.current) setSlots({ date, status: "ready", slots: result });
        },
        () => {
          // Nie still „nichts frei“: Der Schritt sagt, dass es nicht geklappt hat.
          if (token === slotsRequest.current) setSlots({ date, status: "failed", slots: [] });
        },
      );
    },
    [provider],
  );

  const selectType = useCallback(
    (typeId: string) => {
      if (typeId === draft.typeId) return;
      slotsRequest.current++;
      patchDraft({ typeId, date: null, slotId: null, time: null });
      setSlots(null);
    },
    [draft.typeId, patchDraft],
  );

  const selectDate = useCallback(
    (date: ISODate) => {
      if (date === draft.date && slots?.date === date && slots.status !== "failed") return;
      patchDraft({ date, slotId: null, time: null });
      // Die Zeiten laden schon, während jemand „Weiter“ sucht
      loadSlots(date, draft.typeId);
    },
    [draft.date, draft.typeId, slots, patchDraft, loadSlots],
  );

  const selectSlot = useCallback(
    (slot: BookingSlot) => patchDraft({ slotId: slot.id, time: slot.time }),
    [patchDraft],
  );

  /** Ist der Schritt vollständig? (Angaben prüft das Formular selbst.) */
  const complete = useMemo(
    () => [Boolean(draft.typeId), Boolean(draft.date && provider), Boolean(draft.slotId), true, true],
    [draft.typeId, draft.date, draft.slotId, provider],
  );

  const goTo = useCallback(
    (target: number) => {
      if (sending.current) return;
      setSend((s) => (s.kind === "error" ? { kind: "idle" } : s));
      // Zu den Zeiten: Sind sie für den Tag nicht (mehr) da, neu holen
      if (target === 2 && draft.date && (slots?.date !== draft.date || slots.status === "failed")) {
        loadSlots(draft.date, draft.typeId);
      }
      setStep(Math.max(0, Math.min(STEP_COUNT - 1, target)));
    },
    [draft.date, draft.typeId, slots, loadSlots],
  );

  const next = useCallback(() => goTo(step + 1), [goTo, step]);
  const back = useCallback(() => goTo(step - 1), [goTo, step]);

  const submit = useCallback(async () => {
    if (!provider || sending.current) return;
    sending.current = true;
    setSend({ kind: "sending" });
    try {
      const result = await provider.createBooking(draft);
      if (!result.ok) setSend({ kind: "error", text: result.error, code: result.code });
      else if (result.method === "confirmed") setSend({ kind: "done", method: "confirmed", booked: result });
      else setSend({ kind: "done", method: result.method });
    } catch {
      const errors = bookingCopy.errors;
      setSend({ kind: "error", text: provider.mode === "confirmed" ? errors.sendConfirmed : errors.send });
    } finally {
      sending.current = false;
    }
  }, [provider, draft]);

  /** Die Zeit wurde gerade vergeben: zurück zu den Zeiten desselben Tages, frisch geladen. */
  const otherTime = useCallback(() => {
    if (!draft.date) return;
    setSend({ kind: "idle" });
    patchDraft({ slotId: null, time: null });
    loadSlots(draft.date, draft.typeId);
    setStep(2);
  }, [draft.date, draft.typeId, patchDraft, loadSlots]);

  const reset = useCallback(() => {
    setDraft(emptyDraft);
    setSlots(null);
    setSend({ kind: "idle" });
    setCalendarSaved(false);
    setStep(0);
  }, []);

  // Bis der Provider steht, gilt der Wunschtermin – der ehrliche Default.
  // Ist die Website gegen das Cockpit gebaut, entscheidet erst dessen Antwort
  // zwischen Anfrage und Buchung.
  const mode = provider?.mode ?? "request";
  const modePending = !provider && !providerFailed && site.bookingProvider === "cockpit";

  return {
    provider,
    providerFailed,
    retryProvider,
    prepare,
    mode,
    modePending,
    step,
    draft,
    patchDraft,
    slots,
    loadSlots,
    selectType,
    selectDate,
    selectSlot,
    complete,
    goTo,
    next,
    back,
    send,
    submit,
    otherTime,
    reset,
    calendarSaved,
    setCalendarSaved,
  };
}

export type BookingFlow = ReturnType<typeof useBookingFlow>;
