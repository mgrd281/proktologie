"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** „Tagesblatt drucken“ von einer anderen Seite: hier ankommen, drucken, Adresse aufräumen. */
export function PrintOnLoad() {
  const router = useRouter();
  useEffect(() => {
    window.print();
    router.replace("/");
  }, [router]);
  return null;
}
