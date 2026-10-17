import { requireActorOrRedirect } from "@/lib/auth/actor";
import { listClosedRequests, listRequests } from "@/lib/booking/requests";
import { RequestsPanel } from "@/components/requests/RequestsPanel";

export const metadata = { title: "Anfragen" };

export default async function RequestsPage() {
  await requireActorOrRedirect();
  // Offene und erledigte getrennt: Sonst verdrängten viele erledigte die offenen
  const [open, closed] = await Promise.all([listRequests({ open: true, limit: 1000 }), listClosedRequests(30)]);
  return <RequestsPanel open={open} closed={closed} now={new Date().toISOString()} />;
}
