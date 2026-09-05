/** Minimaler className-Helfer – identisch zur Website (kein tailwind-merge). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
