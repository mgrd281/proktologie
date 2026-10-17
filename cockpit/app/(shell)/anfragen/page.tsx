import { requireActorOrRedirect } from "@/lib/auth/actor";
import { listClosedRequests, listRequests } from "@/lib/booking/requests";
import { teamNames } from "@/lib/booking/repo";
import { RequestsPanel } from "@/components/requests/RequestsPanel";

export const metadata = { title: "Anfragen" };

export default async function RequestsPage() {
  await requireActorOrRedirect();
  // Offene und erledigte getrennt: Sonst verdrängten viele erledigte die offenen
  const [open, closed] = await Promise.all([listRequests({ open: true, limit: 1000 }), listClosedRequests(30)]);
  const names = await teamNames(open.map((r) => r.assigneeId ?? ""));
  return <RequestsPanel open={open} closed={closed} now={new Date().toISOString()} names={names} />;
}
