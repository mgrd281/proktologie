import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Channel, OutgoingMessage, SendResult } from "./channel.ts";

/**
 * E-Mail-Kanal.
 * - EMAIL_PROVIDER=brevo + EMAIL_API_KEY: Versand über die Brevo-HTTP-API
 *   (EU-Anbieter, AVV möglich). Absender: EMAIL_FROM / EMAIL_FROM_NAME.
 * - sonst: Protokoll-Kanal. Nichts verlässt das System; in der Entwicklung
 *   landet jede Nachricht als JSON unter MAIL_OUTBOX_DIR (Standard
 *   .mail-outbox/), damit Tests Inhalt und Anhänge prüfen können.
 */
export function emailFrom(): { email: string; name: string } {
  return {
    email: process.env.EMAIL_FROM ?? "termine@proktologie-eimsbuettel.de",
    name: process.env.EMAIL_FROM_NAME ?? "Proktologie Eimsbüttel",
  };
}

class BrevoChannel implements Channel {
  readonly kind = "email" as const;
  readonly label = "Brevo";
  readonly live = true;
  constructor(private readonly apiKey: string) {}

  async send(msg: OutgoingMessage): Promise<SendResult> {
    const from = emailFrom();
    const body = {
      sender: { email: from.email, name: from.name },
      to: [{ email: msg.to, name: msg.toName }],
      subject: msg.subject,
      textContent: msg.text,
      htmlContent: msg.html,
      attachment: msg.attachments?.map((a) => ({
        name: a.filename,
        content: a.encoding === "base64" ? a.content : Buffer.from(a.content, "utf8").toString("base64"),
      })),
    };
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": this.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Brevo ${res.status}: ${text.slice(0, 200)}`);
    }
    const j = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { providerId: j.messageId };
  }
}

class LogChannel implements Channel {
  readonly kind = "email" as const;
  readonly label = "Protokoll (kein Versand)";
  readonly live = false;

  async send(msg: OutgoingMessage): Promise<SendResult> {
    const dir = process.env.MAIL_OUTBOX_DIR ?? (process.env.NODE_ENV === "production" ? null : ".mail-outbox");
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (dir && !process.env.VERCEL) {
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${id}.json`), JSON.stringify(msg, null, 2));
      } catch {
        /* Dateisystem nicht beschreibbar (z. B. Serverless) – Protokoll reicht */
      }
    }
    return { providerId: `log-${id}` };
  }
}

let cached: Channel | null = null;

export function emailChannel(): Channel {
  if (cached) return cached;
  const key = process.env.EMAIL_API_KEY;
  const provider = (process.env.EMAIL_PROVIDER ?? (key ? "brevo" : "log")).toLowerCase();
  cached = provider === "brevo" && key ? new BrevoChannel(key) : new LogChannel();
  return cached;
}

/** Nur für Tests: Kanal neu bestimmen. */
export function resetEmailChannel() {
  cached = null;
}
