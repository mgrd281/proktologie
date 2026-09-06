import { requireActorOrRedirect } from "@/lib/auth/actor";
import { getSettings, listTypes, listWaitlist } from "@/lib/booking/repo";
import { dateKey } from "@/lib/time";
import { WaitlistPanel } from "@/components/waitlist/WaitlistPanel";

export const metadata = { title: "Warteliste" };

export default async function WaitlistPage() {
  await requireActorOrRedirect();
  const [all, types, settings] = await Promise.all([listWaitlist({ includeClosed: true }), listTypes(), getSettings()]);
  const open = all.filter((w) => w.status === "open" || w.status === "offered");
  const closed = all.filter((w) => w.status !== "open" && w.status !== "offered").slice(-30).reverse();
  return <WaitlistPanel open={open} closed={closed} types={types} today={dateKey(new Date())} holdHours={settings.waitlistHoldHours} bookingLive={settings.bookingLive} />;
}
