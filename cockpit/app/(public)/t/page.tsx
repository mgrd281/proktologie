import type { Metadata } from "next";
import { ManageClient } from "./ManageClient";

export const metadata: Metadata = {
  title: "Ihr Termin",
  robots: { index: false, follow: false },
};

/**
 * /t/#<token> – der Link aus Bestätigung, Erinnerung und Wartelisten-Angebot.
 * Das Token steht im Fragment: Es erreicht nie den Server als URL, nur als
 * POST-Body an /api/public/v1/manage. Die Seite selbst ist statisch.
 */
export default function ManagePage() {
  return <ManageClient />;
}
