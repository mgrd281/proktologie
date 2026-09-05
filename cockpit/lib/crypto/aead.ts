import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Feldverschlüsselung für personenbezogene und Gesundheitsdaten:
 * AES-256-GCM, Schlüssel aus DATA_KEY_V<n> (Base64, 32 Bytes).
 * Umschlag: "v<n>:<iv>:<ciphertext>:<tag>" (Base64url) – die Version steht
 * im Umschlag, damit eine Rotation (neuer Schlüssel DATA_KEY_V2) alte
 * Datensätze weiter lesen und lazy neu verschlüsseln kann.
 *
 * `aad` (additional authenticated data) bindet den Klartext an seinen
 * Kontext, z. B. die Datensatz-ID: Ein Umschlag lässt sich dann nicht in
 * einen anderen Datensatz kopieren, ohne dass die Prüfung fehlschlägt.
 */

const KEY_PREFIX = "DATA_KEY_V";

function loadKey(version: number): Buffer {
  const raw = process.env[`${KEY_PREFIX}${version}`];
  if (!raw) throw new Error(`Schlüssel ${KEY_PREFIX}${version} fehlt`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`${KEY_PREFIX}${version} muss 32 Bytes (Base64) sein`);
  return key;
}

/** Höchste konfigurierte Schlüsselversion – neue Datensätze nutzen sie. */
export function currentKeyVersion(): number {
  let v = 0;
  for (const name of Object.keys(process.env)) {
    const m = name.match(/^DATA_KEY_V(\d+)$/);
    if (m && process.env[name]) v = Math.max(v, Number(m[1]));
  }
  if (v === 0) throw new Error("Kein DATA_KEY_V<n> konfiguriert");
  return v;
}

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

export function encrypt(plain: string, aad = ""): string {
  const version = currentKeyVersion();
  const key = loadKey(version);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v${version}:${b64u(iv)}:${b64u(ct)}:${b64u(cipher.getAuthTag())}`;
}

export function decrypt(envelope: string, aad = ""): string {
  const parts = envelope.split(":");
  if (parts.length !== 4 || !/^v\d+$/.test(parts[0]!)) throw new Error("Ungültiger Umschlag");
  const version = Number(parts[0]!.slice(1));
  const key = loadKey(version);
  const decipher = createDecipheriv("aes-256-gcm", key, fromB64u(parts[1]!));
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(fromB64u(parts[3]!));
  return Buffer.concat([decipher.update(fromB64u(parts[2]!)), decipher.final()]).toString("utf8");
}

/** Umschlagversion lesen, ohne zu entschlüsseln (für Rotationsläufe). */
export function envelopeVersion(envelope: string): number {
  const m = envelope.match(/^v(\d+):/);
  return m ? Number(m[1]) : 0;
}

/** JSON-Komfort: Objekt → Umschlag / Umschlag → Objekt. */
export function encryptJson(value: unknown, aad = ""): string {
  return encrypt(JSON.stringify(value), aad);
}
export function decryptJson<T>(envelope: string, aad = ""): T {
  return JSON.parse(decrypt(envelope, aad)) as T;
}
