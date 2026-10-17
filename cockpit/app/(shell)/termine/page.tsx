import { requireActorOrRedirect } from "@/lib/auth/actor";
import { getAppointment, getWaitlistEntry, listAppointments, listExceptions, listHours, listTypes } from "@/lib/booking/repo";
import { getRequest } from "@/lib/booking/requests";
import type { NewPrefill } from "@/components/calendar/AppointmentDrawer";
import { addDays, dateKey, startOfDay, startOfWeek } from "@/lib/time";
import { CalendarView, type CalendarViewMode } from "@/components/calendar/CalendarView";

export const metadata = { title: "Termine" };

export default async function TerminePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; d?: string; neu?: string; ausnahme?: string; id?: string; t?: string; art?: string; anfrage?: string; warteliste?: string }>;
}) {
  await requireActorOrRedirect();
  const sp = await searchParams;
  const now = new Date();
  const today = dateKey(now);
  // ?id= (Suche, Warteliste): der Termin samt seinem Tag – egal, was sonst in der Adresse steht
  const target = sp.id ? await getAppointment(sp.id) : null;
  // „Termin anlegen“ aus einer Anfrage oder von der Warteliste: Die Daten kommen
  // hier vom Server, nie über die Adresse (keine Namen in Verlauf und Protokollen)
  const fromRequest = sp.anfrage && /^[0-9a-f-]{36}$/.test(sp.anfrage) ? await getRequest(sp.anfrage) : null;
  const fromWaitlist = !fromRequest && sp.warteliste ? await getWaitlistEntry(sp.warteliste) : null;
  const prefill: NewPrefill | null = fromRequest
    ? {
        pii: { firstName: fromRequest.pii.firstName, lastName: fromRequest.pii.lastName, email: fromRequest.pii.email ?? null, phone: fromRequest.pii.phone ?? null },
        link: { requestId: fromRequest.id, ref: fromRequest.ref },
      }
    : fromWaitlist
      ? {
          typeId: fromWaitlist.typeId,
          pii: { firstName: fromWaitlist.pii.firstName, lastName: fromWaitlist.pii.lastName, email: fromWaitlist.pii.email ?? null, phone: fromWaitlist.pii.phone ?? null },
          link: { waitlistId: fromWaitlist.id, ref: fromWaitlist.ref },
        }
      : null;
  const date = target ? dateKey(new Date(target.startsAt)) : /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : today;
  const view: CalendarViewMode = sp.v === "woche" || sp.v === "agenda" ? sp.v : "tag";

  const rangeStart = view === "tag" ? date : startOfWeek(date);
  const rangeDays = view === "tag" ? 1 : 7;
  const from = startOfDay(rangeStart);
  const to = startOfDay(addDays(rangeStart, rangeDays));

  const [appointments, exceptions, types, hours] = await Promise.all([
    listAppointments(from, to, { includeCancelled: true }),
    listExceptions(from, to),
    listTypes(true),
    listHours(),
  ]);

  return (
    <CalendarView
      view={view}
      date={date}
      today={today}
      now={now.toISOString()}
      appointments={appointments}
      exceptions={exceptions}
      types={types}
      hours={hours}
      openNew={sp.neu === "1" || Boolean(prefill)}
      openPrefill={prefill}
      openTime={/^\d{2}:\d{2}$/.test(sp.t ?? "") ? sp.t! : null}
      openType={sp.art ?? null}
      openException={sp.ausnahme === "1"}
      openId={target?.id ?? null}
    />
  );
}
