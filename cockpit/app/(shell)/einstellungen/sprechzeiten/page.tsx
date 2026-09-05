import { requireActorOrRedirect } from "@/lib/auth/actor";
import { listExceptions, listHours } from "@/lib/booking/repo";
import { HoursEditor } from "@/components/settings/HoursEditor";

export const metadata = { title: "Sprechzeiten" };

export default async function HoursPage() {
  const actor = await requireActorOrRedirect();
  const now = new Date();
  const [hours, exceptions] = await Promise.all([listHours(), listExceptions(now, new Date(now.getTime() + 365 * 86400_000))]);
  return <HoursEditor hours={hours} exceptions={exceptions} canEdit={actor.role !== "empfang"} today={now.toISOString().slice(0, 10)} />;
}
