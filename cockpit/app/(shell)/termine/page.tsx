import { requireActorOrRedirect } from "@/lib/auth/actor";
import { listAppointments, listExceptions, listHours, listTypes } from "@/lib/booking/repo";
import { addDays, dateKey, startOfDay, startOfWeek } from "@/lib/time";
import { CalendarView, type CalendarViewMode } from "@/components/calendar/CalendarView";

export const metadata = { title: "Termine" };

export default async function TerminePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; d?: string; neu?: string; ausnahme?: string; id?: string }>;
}) {
  await requireActorOrRedirect();
  const sp = await searchParams;
  const now = new Date();
  const today = dateKey(now);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : today;
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
      openNew={sp.neu === "1"}
      openException={sp.ausnahme === "1"}
      openId={sp.id ?? null}
    />
  );
}
