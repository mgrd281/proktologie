import { requireActorOrRedirect } from "@/lib/auth/actor";
import { listRequests, OPEN_REQUEST_STATUSES } from "@/lib/booking/requests";
import { RequestsPanel } from "@/components/requests/RequestsPanel";

export const metadata = { title: "Anfragen" };

export default async function RequestsPage() {
  await requireActorOrRedirect();
  const all = await listRequests({ limit: 300 });
  const open = all.filter((r) => OPEN_REQUEST_STATUSES.includes(r.status));
  const closed = all.filter((r) => !OPEN_REQUEST_STATUSES.includes(r.status)).slice(0, 30);
  return <RequestsPanel open={open} closed={closed} now={new Date().toISOString()} />;
}
