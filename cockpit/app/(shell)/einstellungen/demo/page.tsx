import { requireActorOrRedirect } from "@/lib/auth/actor";
import { countDemo, getSettings, recentMessages } from "@/lib/booking/repo";
import { pendingCount } from "@/lib/jobs/queue";
import { emailChannel } from "@/lib/messaging/email";
import { DemoPanel } from "@/components/settings/DemoPanel";

export const metadata = { title: "Demo & Betrieb" };

export default async function DemoPage() {
  const actor = await requireActorOrRedirect();
  const [settings, demoCount, messages, pendingJobs] = await Promise.all([getSettings(), countDemo(), recentMessages(20), pendingCount()]);
  const channel = emailChannel();
  return (
    <DemoPanel
      canEdit={actor.role !== "empfang"}
      demoCount={demoCount}
      settings={{
        slotStepMin: settings.slotStepMin,
        bookingLive: settings.bookingLive,
        bookingPaused: settings.bookingPaused,
        bannerText: settings.bannerText,
        waitlistHoldHours: settings.waitlistHoldHours,
        maxFuturePerEmail: settings.maxFuturePerEmail,
        reminderOffsetsH: settings.reminderOffsetsH,
      }}
      channel={{ label: channel.label, live: channel.live }}
      messages={messages}
      pendingJobs={pendingJobs}
      cronConfigured={Boolean(process.env.CRON_SECRET)}
    />
  );
}
