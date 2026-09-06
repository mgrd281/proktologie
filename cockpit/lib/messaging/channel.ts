/**
 * Versandkanäle. Die Fachlogik kennt nur dieses Interface; welcher Anbieter
 * dahintersteht (Brevo, Scaleway, Protokoll im Test), entscheidet die
 * Umgebung. Nachrichtentexte werden NIE in der Datenbank abgelegt – nur
 * das Versandprotokoll (Tabelle messages) ohne Inhalt.
 */
export interface Attachment {
  filename: string;
  contentType: string;
  /** Inhalt als UTF-8-Text (ICS) oder Base64 (PDF) */
  content: string;
  encoding?: "utf8" | "base64";
}

export interface OutgoingMessage {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Attachment[];
  /** Für Kalender-Einladungen: METHOD des ICS (REQUEST/CANCEL) */
  calendarMethod?: "REQUEST" | "CANCEL";
}

export interface SendResult {
  providerId?: string;
}

export interface Channel {
  readonly kind: "email" | "sms";
  /** Menschlich lesbarer Name für die Einstellungen (z. B. "Brevo", "Protokoll") */
  readonly label: string;
  /** Wirklich nach außen oder nur protokolliert? */
  readonly live: boolean;
  send(msg: OutgoingMessage): Promise<SendResult>;
}
