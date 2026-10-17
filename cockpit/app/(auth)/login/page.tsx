import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { safeNext } from "@/lib/auth/next";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ weiter?: string; grund?: string }> }) {
  const actor = await getActor();
  const sp = await searchParams;
  if (actor && sp.grund !== "frisch") redirect(safeNext(sp.weiter));
  return <LoginForm next={safeNext(sp.weiter)} reason={sp.grund} />;
}
