/** Konstanten, die Client-Komponenten brauchen dürfen (ohne Server-Importe). */
export const ROLES = ["arzt", "empfang", "admin"] as const;
export type Role = (typeof ROLES)[number];
