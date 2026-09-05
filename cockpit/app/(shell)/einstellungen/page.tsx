import { requireActorOrRedirect } from "@/lib/auth/actor";
import { listTypes } from "@/lib/booking/repo";
import { TypesManager } from "@/components/settings/TypesManager";

export const metadata = { title: "Terminarten" };

export default async function TypesPage() {
  const actor = await requireActorOrRedirect();
  const types = await listTypes(true);
  return <TypesManager types={types} canEdit={actor.role !== "empfang"} />;
}
