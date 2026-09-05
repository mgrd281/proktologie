import type { ReactNode } from "react";
import { PageTitle } from "@/components/ui/Bits";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageTitle eyebrow="Einstellungen" title="Praxis einrichten" />
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </>
  );
}
