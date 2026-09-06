import { appointmentTypes, bookingCopy } from "@/content/booking";
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
 * wurde – sonst bleibt die Website beim Wunschtermin-Provider.
 *
 * Grundsätze:
 * - Es werden nur Terminart, Datum, Uhrzeit und die vier Kontaktangaben
 *   übertragen (JSON, POST). Keine Daten in URLs, nichts im localStorage.
 * - Das Formular-Token aus der Verfügbarkeits-Antwort muss mindestens
 *   drei Sekunden alt sein (Missbrauchsschutz) – der Provider wartet
 *   notfalls kurz, statt den Nutzer mit einem Fehler zu konfrontieren.
 * - Der Honigtopf (`website`) wird als `hp` mitgeschickt: leer für Menschen.
 */

const API_BASE = (process.env.NEXT_PUBLIC_COCKPIT_API ?? "").replace(/\/$/, "");
const MIN_TOKEN_AGE_MS = 3200;
const MAX_TOKEN_AGE_MS = 25 * 60_000;

interface AvailabilityResponse {
  typeId: string;
  from: ISODate;
  to: ISODate;
  days: Array<{ date: ISODate; slots: string[] }>;
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok) throw new ApiError(body.error?.code ?? "http", body.error?.message ?? bookingCopy.errors.send);
  return body;
}

export class CockpitBookingProvider implements BookingProvider {
  readonly mode = "confirmed" as const;
  /** `${typeId}|${date}` → freie Startzeiten */
  private readonly slots = new Map<string, string[]>();
  private token: { value: string; issuedAt: number } | null = null;
  private types: AppointmentType[] | null = null;

  private async fetchAvailability(typeId: string, from: ISODate, to: ISODate): Promise<AvailabilityResponse> {
    const r = await request<AvailabilityResponse>(`/api/public/v1/availability?type=${encodeURIComponent(typeId)}&from=${from}&to=${to}`);
    for (const d of r.days) this.slots.set(`${typeId}|${d.date}`, d.slots);
    this.token = { value: r.formToken, issuedAt: Date.now() };
    return r;
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
    try {
      const r = await this.fetchAvailability(typeId, from, toISO(last));
      const withSlots = new Set(r.days.filter((d) => d.slots.length > 0).map((d) => d.date));
      return days.map((d) => ({ ...d, selectable: withSlots.has(d.date) }));
    } catch {
      return days;
    }
  }

  async getAvailableSlots(date: ISODate, typeId?: string | null): Promise<BookingSlot[]> {
    if (!typeId) return [];
    let times = this.slots.get(`${typeId}|${date}`);
    if (!times) {
      try {
        const r = await this.fetchAvailability(typeId, date, date);
        times = r.days.find((d) => d.date === date)?.slots ?? [];
      } catch {
        return [];
      }
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
    if (!draft.typeId || !draft.date || !draft.time) return { ok: false, error: bookingCopy.errors.send };
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
    const send = async (formToken: string) =>
      request<{ ref: string; startsAt: string; endsAt: string }>("/api/public/v1/bookings", { method: "POST", body: JSON.stringify(payload(formToken)) });

    try {
      let r: { ref: string; startsAt: string; endsAt: string };
      try {
        r = await send(await this.freshToken(draft.typeId, draft.date));
      } catch (e) {
        if (!(e instanceof ApiError) || e.code !== "form_token") throw e;
        // Token verworfen (z. B. Serverneustart): einmal neu holen und erneut versuchen
        this.token = null;
        r = await send(await this.freshToken(draft.typeId, draft.date));
      }
      // Belegung ist jetzt veraltet – beim nächsten Blick neu laden
      this.slots.delete(`${draft.typeId}|${draft.date}`);
      return { ok: true, method: "confirmed", ref: r.ref, startsAt: r.startsAt, endsAt: r.endsAt };
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "slot_taken") this.slots.delete(`${draft.typeId}|${draft.date}`);
        const known = ["slot_taken", "too_many", "paused", "not_live", "rate_limited", "validation"];
        return { ok: false, code: e.code, error: known.includes(e.code) ? e.message : bookingCopy.errors.send };
      }
      return { ok: false, error: bookingCopy.errors.send };
    }
  }

  async cancelBooking(): Promise<BookingResult> {
    // Absagen und Verschieben laufen über den persönlichen Link aus der Bestätigungs-Mail
    return { ok: false, error: bookingCopy.errors.cancelViaLink };
  }
}
