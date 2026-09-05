import { requireActorOrRedirect } from "@/lib/auth/actor";
import { countDemo, getSettings } from "@/lib/booking/repo";
import { DemoPanel } from "@/components/settings/DemoPanel";

export const metadata = { title: "Demo & Betrieb" };

export default async function DemoPage() {
  const actor = await requireActorOrRedirect();
  const [settings, demoCount] = await Promise.all([getSettings(), countDemo()]);
  return (
    <DemoPanel
      canEdit={actor.role !== "empfang"}
      demoCount={demoCount}
      settings={{
        slotStepMin: settings.slotStepMin,
        bookingLive: settings.bookingLive,
        bookingPaused: settings.bookingPaused,
        bannerText: settings.bannerText,
      }}
    />
  );
}
