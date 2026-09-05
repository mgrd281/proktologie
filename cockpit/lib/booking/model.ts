/**
 * Ansichtsmodelle – frei von Server-Importen, damit Client-Komponenten sie
 * typisieren können. Personenbezogene Felder erscheinen hier bereits
 * entschlüsselt: Diese Objekte verlassen den Server nur an angemeldete
 * Cockpit-Nutzer, nie an die öffentliche API.
 */
export type AppointmentStatus = "booked" | "confirmed" | "reminded" | "completed" | "no_show" | "cancelled";
export type AppointmentSource = "web" | "cockpit" | "telefon";
export type TypeColor = "green" | "moss" | "amber" | "slate" | "blue";
export type ExceptionKind = "closed" | "blocker" | "urlaub" | "extern";

export const ACTIVE_STATUSES: AppointmentStatus[] = ["booked", "confirmed", "reminded"];

export interface Pii {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface TypeView {
  id: string;
  label: string;
  note: string | null;
  durationMin: number;
  bufferMin: number;
  visibility: "public" | "intern";
  leadTimeHours: number;
  maxAheadDays: number;
  color: TypeColor;
  sortOrder: number;
  active: boolean;
}

export interface AppointmentView {
  id: string;
  ref: string;
  typeId: string;
  typeLabel: string;
  color: TypeColor;
  startsAt: string; // ISO
  endsAt: string;
  bufferMin: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  pii: Pii;
  note: string | null;
  isDemo: boolean;
  remindedAt: string | null;
  confirmedByPatientAt: string | null;
  createdAt: string;
}

export interface ExceptionView {
  id: string;
  kind: ExceptionKind;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  label: string | null;
  isDemo: boolean;
}

export interface HoursRow {
  weekday: number;
  opens: string;
  closes: string;
}

export interface SettingsView {
  slotStepMin: number;
  bookingLive: boolean;
  bookingPaused: boolean;
  bannerText: string | null;
  autoReplyText: string | null;
  intakeRetentionDays: number;
  reminderOffsetsH: number[];
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  booked: "Gebucht",
  confirmed: "Bestätigt",
  reminded: "Erinnert",
  completed: "Wahrgenommen",
  no_show: "Nicht erschienen",
  cancelled: "Abgesagt",
};

export const SOURCE_LABEL: Record<AppointmentSource, string> = {
  web: "Website",
  cockpit: "Cockpit",
  telefon: "Telefon",
};

export const KIND_LABEL: Record<ExceptionKind, string> = {
  closed: "Geschlossen",
  blocker: "Blocker",
  urlaub: "Urlaub",
  extern: "Extern belegt",
};
