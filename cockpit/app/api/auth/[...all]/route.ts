import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";

const handler = toNextJsHandler(auth);

// Bereitschaft der Datenbank vor jeder Auth-Anfrage (PGlite: Migrationen)
export async function GET(req: Request) {
  await getDb();
  return handler.GET(req);
}
export async function POST(req: Request) {
  await getDb();
  return handler.POST(req);
}
