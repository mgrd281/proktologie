import { appointmentTypes, bookingCopy } from "@/content/booking";
import { site } from "@/content/site";
import type { BookingProvider } from "@/lib/booking/provider";
import type {
  AppointmentType,
  BookingDay,
  BookingDraft,
  BookingResult,
  BookingSlot,
  ISODate,
} from "@/lib/booking/types";

/**
 * Provider „verbindlich" (mode: "confirmed"): spricht mit der öffentlichen
 * API des Praxis-Cockpits. Aktiv nur, wenn der Build mit
 * NEXT_PUBLIC_BOOKING_PROVIDER=cockpit und NEXT_PUBLIC_COCKPIT_API gebaut
 * wurde UND das Cockpit beim Laden „Website-Buchung live“ meldet (die
 * Auswahl trifft createBookingProvider) – sonst bleibt die Website beim
 * Wunschtermin-Provider.
 *
 * Grundsätze:
 * - Es werden nur Terminart, Datum, Uhrzeit und die vier Kontaktangaben
 *   übertragen (JSON, POST). Keine Daten in URLs, nichts im localStorage.
 * - Das Formular-Token aus der Verfügbarkeits-Antwort muss mindestens
 *   drei Sekunden alt sein (Missbrauchsschutz) – der Provider wartet
 *   notfalls kurz, statt den Nutzer mit einem Fehler zu konfrontieren.
 * - Der Honigtopf (`website`) wird als `hp` mitgeschickt: leer für Menschen.
 * - Was ein Abruf an freien Zeiten liefert, gilt eine Minute lang: Der
 *   früheste freie Tag (Kamerafahrt, Kalender) und der Monat, in dem er
 *   liegt, kommen so aus EINEM Abruf.
 */

// Eine Quelle für die Basis-URL: content/site.ts liest die Umgebung
const API_BASE = site.cockpitApiUrl;
const MIN_TOKEN_AGE_MS = 3200;
const MAX_TOKEN_AGE_MS = 25 * 60_000;
/** So lange gilt geladene Verfügbarkeit als frisch (wie der Status im Cockpit). */
const FRESH_MS = 60_000;
/** Größter Zeitraum je Abruf – wie MAX_RANGE_DAYS in cockpit/lib/booking/public.ts. */
const MAX_RANGE_DAYS = 45;

interface AvailabilityResponse {
  typeId: string;
  from: ISODate;
  to: ISODate;
  days: Array<{ date: ISODate; slots: string[] }>;
  /** Letzter buchbarer Tag der Terminart (ältere Cockpits liefern ihn nicht). */
  lastDate?: ISODate | null;
  formToken: string;
}
interface ApiErrorBody {
  error?: { code?: string; message?: string };
}
class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso: ISODate, n: number): ISODate => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok) throw new ApiError(body.error?.code ?? "http", body.error?.message ?? bookingCopy.errors.sendConfirmed);
  return body;
}

export class CockpitBookingProvider implements BookingProvider {
  readonly mode = "confirmed" as const;
  /** `${typeId}|${date}` → freie Startzeiten */
  private readonly slots = new Map<string, string[]>();
  private token: { value: string; issuedAt: number } | null = null;
  private types: AppointmentType[] | null = null;
  /** typeId → letzter buchbarer Tag */
  private readonly lastDates = new Map<string, ISODate>();
  /** typeId → frisch geladene Zeiträume (die Zeiten selbst liegen in `slots`) */
  private readonly loaded = new Map<string, Array<{ from: ISODate; to: ISODate; at: number }>>();
  /** typeId → frühester freier Tag (laufender oder fertiger Abruf) */
  private readonly earliest = new Map<string, { at: number; value: Promise<ISODate | null> }>();

  private async fetchAvailability(typeId: string, from: ISODate, to: ISODate): Promise<AvailabilityResponse> {
    const r = await request<AvailabilityResponse>(`/api/public/v1/availability?type=${encodeURIComponent(typeId)}&from=${from}&to=${to}`);
    for (const d of r.days) this.slots.set(`${typeId}|${d.date}`, d.slots);
    if (r.lastDate) this.lastDates.set(typeId, r.lastDate);
    this.token = { value: r.formToken, issuedAt: Date.now() };
    const now = Date.now();
    const fresh = (this.loaded.get(typeId) ?? []).filter((x) => now - x.at < FRESH_MS);
    this.loaded.set(typeId, [...fresh, { from: r.from, to: r.to, at: now }]);
    return r;
  }

  /** Deckt ein frischer Abruf den Zeitraum ab? Dann stimmen die Zeiten in `slots`. */
  private isFresh(typeId: string, from: ISODate, to: ISODate): boolean {
    const now = Date.now();
    return (this.loaded.get(typeId) ?? []).some((x) => now - x.at < FRESH_MS && x.from <= from && to <= x.to);
  }

  /** Nach einer Buchung (oder „schon vergeben“) ist die Belegung veraltet. */
  private forget(typeId: string, date: ISODate) {
    this.slots.delete(`${typeId}|${date}`);
    this.loaded.delete(typeId);
    this.earliest.delete(typeId);
  }

  lastBookableDate(typeId?: string | null): ISODate | null {
    return (typeId && this.lastDates.get(typeId)) || null;
  }

  async getAppointmentTypes(): Promise<AppointmentType[]> {
    if (this.types) return this.types;
    try {
      const r = await request<{ types: Array<{ id: string; label: string; note: string | null }> }>("/api/public/v1/appointment-types");
      if (!Array.isArray(r.types) || r.types.length === 0) throw new Error("leere Antwort");
      this.types = r.types.map((t) => ({ id: t.id, label: t.label, note: t.note ?? undefined }));
    } catch {
      // Ohne Verbindung: die statische Liste – die Buchung selbst meldet den Fehler
      this.types = appointmentTypes;
    }
    return this.types;
  }

  async getAvailableDates(month: string, typeId?: string | null): Promise<BookingDay[]> {
    const [year, m] = month.split("-").map(Number);
    const first = new Date(year, m - 1, 1);
    const last = new Date(year, m, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: BookingDay[] = [];
    const cursor = new Date(first);
    while (cursor.getMonth() === m - 1) {
      days.push({ date: toISO(cursor), selectable: false });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (!typeId || last < today) return days;
    const from = first < today ? toISO(today) : toISO(first);
    const to = toISO(last);
    // Fehler gehen bewusst an die Oberfläche: Ein Monat, in dem nur alles
    // grau ist, sähe aus wie „ausgebucht“ – die Karte sagt stattdessen, dass
    // das Laden gescheitert ist, und bietet „Erneut versuchen“ und das Telefon.
    if (!this.isFresh(typeId, from, to)) await this.fetchAvailability(typeId, from, to);
    return days.map((d) => ({
      ...d,
      selectable: d.date >= from && (this.slots.get(`${typeId}|${d.date}`)?.length ?? 0) > 0,
    }));
  }

  getEarliestDate(typeId: string): Promise<ISODate | null> {
    const known = this.earliest.get(typeId);
    if (known && Date.now() - known.at < FRESH_MS) return known.value;
    const value = (async () => {
      // Je Abruf höchstens 45 Tage; der Buchungshorizont (meist 56 Tage) ist
      // nach spätestens zwei Abrufen erreicht – drei sind die Sicherung.
      let from = toISO(new Date());
      for (let round = 0; round < 3; round++) {
        const r = await this.fetchAvailability(typeId, from, addDays(from, MAX_RANGE_DAYS - 1));
        const first = r.days.find((d) => d.slots.length > 0);
        if (first) return first.date;
        if (!r.lastDate || r.to >= r.lastDate) return null;
        from = addDays(r.to, 1);
      }
      return null;
    })();
    this.earliest.set(typeId, { at: Date.now(), value });
    // Ein Ladefehler wird nicht gemerkt – der nächste Blick fragt neu
    value.catch(() => {
      if (this.earliest.get(typeId)?.value === value) this.earliest.delete(typeId);
    });
    return value;
  }

  async getAvailableSlots(date: ISODate, typeId?: string | null): Promise<BookingSlot[]> {
    if (!typeId) return [];
    let times = this.slots.get(`${typeId}|${date}`);
    if (!times) {
      // Wie bei den Tagen: Ein Ladefehler ist kein „nichts mehr frei“.
      const r = await this.fetchAvailability(typeId, date, date);
      times = r.days.find((d) => d.date === date)?.slots ?? [];
    }
    return times.map((time) => ({ id: `${date}T${time}`, time, available: true }));
  }

  private async freshToken(typeId: string, date: ISODate): Promise<string> {
    const age = this.token ? Date.now() - this.token.issuedAt : Infinity;
    if (!this.token || age > MAX_TOKEN_AGE_MS) await this.fetchAvailability(typeId, date, date);
    const wait = MIN_TOKEN_AGE_MS - (Date.now() - this.token!.issuedAt);
    if (wait > 0) await sleep(wait);
    return this.token!.value;
  }

  async createBooking(draft: BookingDraft): Promise<BookingResult> {
    if (!draft.typeId || !draft.date || !draft.time) return { ok: false, error: bookingCopy.errors.sendConfirmed };
    const payload = (formToken: string) => ({
      typeId: draft.typeId,
      date: draft.date,
      time: draft.time,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      consent: draft.consent,
      formToken,
      hp: draft.website ?? "",
    });
    type Booked = { ref: string; startsAt: string; endsAt: string; calendarUid?: string };
    const send = async (formToken: string) =>
      request<Booked>("/api/public/v1/bookings", { method: "POST", body: JSON.stringify(payload(formToken)) });

    try {
      let r: Booked;
      try {
        r = await send(await this.freshToken(draft.typeId, draft.date));
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== "form_token") throw e;
        // Token verworfen (z. B. Serverneustart): einmal neu holen und erneut versuchen
        this.token = null;
        r = await send(await this.freshToken(draft.typeId, draft.date));
      }
      // Belegung ist jetzt veraltet – beim nächsten Blick neu laden
      this.forget(draft.typeId, draft.date);
      return { ok: true, method: "confirmed", ref: r.ref, startsAt: r.startsAt, endsAt: r.endsAt, calendarUid: r.calendarUid };
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "slot_taken") this.forget(draft.typeId, draft.date);
        const known = ["slot_taken", "too_many", "paused", "not_live", "rate_limited", "validation"];
        return { ok: false, code: e.code, error: known.includes(e.code) ? e.message : bookingCopy.errors.sendConfirmed };
      }
      return { ok: false, error: bookingCopy.errors.sendConfirmed };
    }
  }

  async cancelBooking(): Promise<BookingResult> {
    // Absagen und Verschieben laufen über den persönlichen Link aus der Bestätigungs-Mail
    return { ok: false, error: bookingCopy.errors.cancelViaLink };
  }
}
