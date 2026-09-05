import { betterAuth } from "better-auth";
import { admin, twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { dbSync } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

/**
 * Authentifizierung des Cockpits.
 *
 * - Kein öffentlicher Sign-up: Konten entstehen nur über Einladungen
 *   (lib/auth/invites.ts) oder den Bootstrap des ersten Administrators.
 * - Primärer Login: Passkey (WebAuthn). Rückfall: E-Mail + Passwort + TOTP.
 * - Sitzung: gleitend 60 min Inaktivität (expiresIn) – die absolute
 *   Obergrenze von 12 h prüft lib/auth/actor.ts über session.createdAt.
 * - Rollen über das Admin-Plugin: arzt · empfang · admin.
 */

export const COCKPIT_URL = process.env.COCKPIT_URL ?? "http://localhost:3100";
const origin = new URL(COCKPIT_URL);

export const ROLES = ["arzt", "empfang", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const IDLE_SECONDS = 60 * 60;
export const ABSOLUTE_SECONDS = 60 * 60 * 12;
/** Für Schritt-hoch-Aktionen (Nutzerverwaltung, Export, Demo-Löschung). */
export const FRESH_SECONDS = 60 * 10;

export const auth = betterAuth({
  appName: "Praxis-Cockpit",
  baseURL: COCKPIT_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(dbSync(), { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 256,
  },
  session: {
    expiresIn: IDLE_SECONDS,
    updateAge: 60 * 5,
    freshAge: FRESH_SECONDS,
    cookieCache: { enabled: true, maxAge: 60 },
  },
  rateLimit: { enabled: true, window: 60, max: 40 },
  advanced: {
    cookiePrefix: "cockpit",
    useSecureCookies: origin.protocol === "https:",
  },
  plugins: [
    admin({ defaultRole: "empfang", adminRoles: ["admin"] }),
    twoFactor({ issuer: "Praxis-Cockpit" }),
    passkey({
      rpID: origin.hostname,
      rpName: "Praxis-Cockpit · Proktologie Eimsbüttel",
      origin: COCKPIT_URL,
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
