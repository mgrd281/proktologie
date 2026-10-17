/**
 * Wie viel vom Film ein Gerät laden soll – reine Logik ohne DOM, prüfbar mit
 *
 *   node --experimental-strip-types --test lib/cinema/loadPolicy.test.mjs
 *
 * Die Leiter (jedes 8. Bild) lädt immer: Mit ihr läuft die Fahrt schon,
 * nur gröber. Den vollen Vorrat (Handy ≈ 3 MB, Desktop ≈ 13 MB) gibt es
 * nicht, wenn jemand Daten spart, das Netz langsam ist (2G/3G) oder das
 * Gerät wenig Speicher hat – dort zählt, dass Buchung und Telefon schnell
 * da sind. Handys holen höchstens vier Bilder zugleich, damit der Rest der
 * Seite im Mobilfunk nicht wartet.
 */

export interface LoadPolicyInput {
  /** navigator.connection.saveData */
  saveData?: boolean;
  /** navigator.connection.effectiveType: "slow-2g" | "2g" | "3g" | "4g" */
  effectiveType?: string;
  /** navigator.deviceMemory in GB (nur Chromium; fehlt anderswo) */
  deviceMemory?: number;
  mobile: boolean;
}

export interface LoadPolicy {
  /** Voller Vorrat nach der ersten Bewegung bzw. im Leerlauf – sonst nur die Leiter. */
  full: boolean;
  fetchConcurrency: number;
}

const SLOW_NETWORK = /^(slow-2g|2g|3g)$/;

export function filmLoadPolicy(input: LoadPolicyInput): LoadPolicy {
  const saving = input.saveData === true;
  const slow = SLOW_NETWORK.test(input.effectiveType ?? "");
  const lowMemory = typeof input.deviceMemory === "number" && input.deviceMemory <= 2;
  return { full: !saving && !slow && !lowMemory, fetchConcurrency: input.mobile ? 4 : 8 };
}

/** Die Eingaben aus dem Browser – was ein Browser nicht meldet, schränkt nichts ein. */
export function readLoadPolicyInput(mobile: boolean): LoadPolicyInput {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  return {
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
    deviceMemory: nav.deviceMemory,
    mobile,
  };
}
