"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { chatCopy, hoursLine, type ChatLang } from "@/content/chat";
import { site } from "@/content/site";
import { sendChat, voiceSpeak, voiceToken, type ChatForm, type ChatQuick } from "@/lib/chat/api";
import { LiveSession, type LiveState } from "@/lib/voice/live";
import { append, browserStore, clear, load, newSession, save, type SessionStore, type StoredSession } from "@/lib/chat/session";
import { useLenis } from "@/providers/LenisProvider";

/**
 * Das Chat-Fenster.
 *
 * Es hält den Verlauf, zeigt Schaltflächen und Formulare und schickt jede
 * Eingabe an das Cockpit. Entschieden wird dort; hier wird nur angezeigt.
 *
 * Drei Dinge sind bewusst so gebaut:
 *
 *  - Der Verlauf liegt in `sessionStorage`, nicht auf dem Server. Ein
 *    Seitenwechsel behält ihn, das Schließen des Tabs löscht ihn.
 *  - Beim Notfall verschwindet das Eingabefeld. Wer 112 braucht, soll
 *    nicht weitertippen, sondern anrufen – die Nummern stehen als große
 *    Schaltflächen da.
 *  - Kontaktdaten werden über beschriftete Formularfelder erfasst, nie
 *    aus dem Fließtext geraten. Sie gehen direkt an die Buchung.
 */

export interface ChatWindowProps {
  lang: ChatLang;
  onLang: (lang: ChatLang) => void;
  onClose: () => void;
  /** Der Chat ist von der Praxis freigeschaltet und erreichbar. */
  available: boolean;
  /** Das Cockpit hat einen Sprachanbieter – nur dann gibt es ein Mikrofon. */
  voice: boolean;
  /** Der Zustand wird gerade abgefragt. */
  checking: boolean;
  hours: string;
}

const EMERGENCY_NUMBERS = [
  { label: "112", href: "tel:112" },
  { label: "116 117", href: "tel:116117" },
];

export function ChatWindow({ lang, onLang, onClose, available, voice, checking, hours }: ChatWindowProps) {
  const copy = chatCopy[lang];
  const storeRef = useRef<SessionStore | null>(null);
  const [session, setSession] = useState<StoredSession>(() => newSession(lang));
  const [quick, setQuick] = useState<ChatQuick[]>([]);
  const [form, setForm] = useState<ChatForm | null>(null);
  const [links, setLinks] = useState<Array<{ label: string; href: string }>>([]);
  const [emergency, setEmergency] = useState(false);
  const [langChosen, setLangChosen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [listening, setListening] = useState<LiveState>("idle");
  const liveRef = useRef<LiveSession | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const talkRef = useRef<((text: string) => void) | null>(null);
  /** Die laufende Sitzungskennung, damit die Sprachsitzung nicht auf einer alten sitzt. */
  const sessionIdRef = useRef(session.sessionId);
  sessionIdRef.current = session.sessionId;
  const { stop, start } = useLenis();

  // Verlauf aus dem Browser holen – oder begrüßen.
  useEffect(() => {
    const store = browserStore();
    storeRef.current = store;
    const restored = load(store);
    if (restored && restored.messages.length > 0) {
      setSession(restored);
      onLang(restored.lang);
      setForm(restored.form ?? null);
      setEmergency(restored.emergency === true);
      setLangChosen(restored.langChosen === true);
      // Ohne gespeicherte Auswahl bleiben die drei Einstiege – besser als
      // ein Fenster ohne jeden Weg.
      setQuick(restored.quick?.length ? restored.quick : restored.form || restored.emergency ? [] : chatCopy[restored.lang].quickStart);
      return;
    }
    const fresh = newSession(lang);
    setSession(append(fresh, "assistant", copy.greeting(hoursLine(lang)), Date.now()));
    setQuick(copy.quickStart);
    // Nur beim ersten Aufbau – danach führt der Verlauf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jede Änderung sofort sichern; der Tab kann jederzeit geschlossen werden.
  useEffect(() => {
    if (session.messages.length > 0) save(storeRef.current, { ...session, lang, open: true, quick, form, emergency, langChosen });
  }, [session, lang, quick, form, emergency, langChosen]);

  /**
   * Neues Gespräch: Verlauf und Zustand weg, neue Sitzungskennung, frische
   * Begrüßung. Das ist auch der Weg aus dem Notfallmodus – die Sperre bleibt
   * bis dahin bestehen, aber sie ist verlassbar.
   */
  const restart = useCallback(() => {
    clear(storeRef.current);
    const fresh = newSession(lang);
    setSession(append(fresh, "assistant", chatCopy[lang].greeting(hoursLine(lang)), Date.now()));
    setQuick(chatCopy[lang].quickStart);
    setForm(null);
    setLinks([]);
    setEmergency(false);
    setPending(false);
    setDraft("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [lang]);

  /**
   * Sprachwechsel durch die Patientin: ab jetzt gilt diese Sprache, sie geht
   * mit jeder Nachricht mit, und die Erkennung überstimmt sie nicht mehr.
   * Steht nur die Begrüßung im Verlauf, wird sie ersetzt; sonst kommt eine
   * kurze Begrüßung in der neuen Sprache dazu.
   */
  const switchLang = useCallback(() => {
    const next: ChatLang = lang === "de" ? "en" : "de";
    const greeting = chatCopy[next].greeting(hoursLine(next));
    setLangChosen(true);
    onLang(next);
    setSession((s) => {
      const onlyGreeting = s.messages.length === 1 && s.messages[0]?.role === "assistant";
      const base = onlyGreeting ? { ...s, messages: [] } : s;
      return { ...append(base, "assistant", greeting, Date.now()), lang: next };
    });
    setQuick((q) => (q.length === 0 || q.every((x) => chatCopy[lang].quickStart.some((s) => s.id === x.id)) ? chatCopy[next].quickStart : q));
  }, [lang, onLang]);

  // Auf dem Telefon füllt das Fenster den Schirm – dann darf die Seite
  // dahinter nicht mitscrollen.
  useEffect(() => {
    const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    if (!mobile) return;
    stop();
    return () => start();
  }, [stop, start]);

  // Escape schließt – wie das Menü im Kopfbereich.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Neue Nachricht: ans Ende scrollen.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [session.messages.length, pending]);

  /**
   * Der Cursor gehört ins Eingabefeld – das ist das einzige Zeichen, das
   * ohne Worte sagt „hier können Sie schreiben“. Ohne ihn liest sich das
   * Fenster als reines Knopfmenü, und der freie Text bleibt ungenutzt.
   *
   * Nur ab Tablettbreite: Auf dem Telefon würde der Fokus die Tastatur
   * aufziehen und das halbe Fenster verdecken, bevor die Patientin
   * überhaupt gelesen hat, was der Assistent kann.
   */
  useEffect(() => {
    if (emergency || form) return;
    if (typeof window === "undefined" || !window.matchMedia("(min-width: 640px)").matches) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [emergency, form, pending]);

  /**
   * Das Feld wächst mit, bis etwa fünf Zeilen. Ein Satz, der beim Tippen
   * aus dem Blick rutscht, lädt niemanden zum Weiterschreiben ein.
   */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

  const talk = useCallback(
    async (payload: { message?: string; action?: Parameters<typeof sendChat>[1]["action"] }, echo?: string) => {
      if (pending) return;
      setPending(true);
      setQuick([]);
      setForm(null);
      setLinks([]);
      let next = session;
      if (echo) {
        next = append(next, "user", echo, Date.now());
        setSession(next);
      }
      const result = await sendChat(site.cockpitApiUrl, { sessionId: next.sessionId, state: next.state, ...(langChosen ? { lang } : {}), ...payload });
      if (!result.ok) {
        setSession(append(next, "assistant", copy.errors[result.error], Date.now()));
        setQuick(copy.quickStart);
        setPending(false);
        return;
      }
      const a = result.answer;
      // Die Sprache der Oberfläche folgt dem Server nur, wenn er sie aus dem
      // Text erkannt hat – nie gegen eine ausdrückliche Wahl.
      const follow = a.flags.langDetected === true && !langChosen && a.lang !== lang;
      setSession({ ...append(next, "assistant", a.reply, Date.now()), state: a.state, lang: follow ? a.lang : lang });
      if (follow) onLang(a.lang);
      setQuick(a.quick ?? []);
      setForm(a.form ?? null);
      setLinks(a.links ?? []);
      if (a.flags.emergency) setEmergency(true);
      setPending(false);
      // Wer gesprochen hat, bekommt gesprochen zurück. Beim Notfall wird
      // nicht vorgelesen: Da soll niemand zuhören, sondern anrufen – die
      // Nummern stehen als große Schaltflächen da.
      if (liveRef.current && !a.flags.emergency) {
        const blob = await voiceSpeak(site.cockpitApiUrl, next.sessionId, a.lang, a.reply);
        if (blob && liveRef.current) await playOnce(audioRef, blob);
      }
      liveRef.current?.answered();
    },
    [pending, session, copy, lang, onLang, langChosen],
  );

  const submitDraft = () => {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    void talk({ message: text }, text);
  };

  const onQuick = (q: ChatQuick) => {
    // Die drei Startknöpfe sind reine Anzeige – sie schicken denselben
    // Bezeichner, den das Cockpit auch sonst versteht.
    void talk({ action: { kind: "quick", id: q.id } }, q.label);
  };

  // Der Automat antwortet, das Mikrofon hört nur zu. Diese Weiche liegt in
  // einer Referenz, damit die Sprachsitzung nicht bei jedem Zug neu gebaut
  // werden muss – ein neu gebautes Mikrofon würde mitten im Satz abreißen.
  talkRef.current = (text: string) => void talk({ message: text }, text);

  /**
   * Zuhören an oder aus.
   *
   * Das Mikrofon geht ausschließlich hier auf, auf Knopfdruck. Erkannter
   * Text geht denselben Weg wie getippter – durch den Automaten mit
   * Notfallpfad und Gesundheitsfilter. Gesprochen wird nur die Antwort.
   */
  const toggleVoice = useCallback(() => {
    const running = liveRef.current;
    if (running) {
      void running.stop();
      liveRef.current = null;
      return;
    }
    const session = new LiveSession({
      token: () => voiceToken(site.cockpitApiUrl, sessionIdRef.current, lang),
      microphone: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }),
      connect: async (secret, stream, on) => {
        const { connectWebRtc } = await import("@/lib/voice/webrtc");
        return connectWebRtc(secret, stream, on);
      },
      onTranscript: (text) => talkRef.current?.(text),
      onState: (state) => {
        setListening(state);
        if (state === "idle") liveRef.current = null;
      },
    });
    liveRef.current = session;
    void session.start();
  }, [lang]);

  // Tab weg, Fenster zu: Ein offenes Mikrofon darf nichts überleben.
  useEffect(() => {
    const away = () => {
      if (document.visibilityState === "hidden") void liveRef.current?.stop("hidden");
    };
    document.addEventListener("visibilitychange", away);
    return () => {
      document.removeEventListener("visibilitychange", away);
      void liveRef.current?.stop("unmount");
    };
  }, []);

  const title = useMemo(() => `${copy.windowTitle} · ${copy.windowSubtitle}`, [copy]);

  // z-[60]: über dem festen Seitenkopf (z-50). Sonst deckt der Kopf auf
  // niedrigen Bildschirmen die obere Leiste des Fensters ab, und
  // „English“, „Neues Gespräch“ und „Schließen“ sind nicht anklickbar.
  return (
    <div
      id="site-chat-window"
      role="dialog"
      aria-label={title}
      className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-mist bg-cream shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,80dvh)] sm:w-[400px] sm:rounded-2xl"
    >
      <header className="flex items-center justify-between gap-3 border-b border-mist bg-white/70 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{copy.windowTitle}</p>
          <p className="truncate text-xs text-ink/70">{copy.windowSubtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={restart}
            disabled={pending}
            className="rounded-lg px-2 py-1 text-xs font-medium text-primary-deep hover:bg-mist disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {copy.restart}
          </button>
          <button
            type="button"
            onClick={switchLang}
            disabled={pending}
            lang={lang === "de" ? "en" : "de"}
            className="rounded-lg px-2 py-1 text-xs font-medium text-primary-deep hover:bg-mist disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {copy.langSwitch}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="rounded-lg p-1.5 text-ink/70 hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      </header>

      {!available && !checking ? (
        <ChatOffline lang={lang} hours={hours} />
      ) : (
        <>
          {/* role="log" gehört auf die Hülle, nicht auf die Liste: Sonst
              verliert das <ol> seine Listenrolle und die Einträge stehen
              nach WCAG 1.3.1 elternlos da. */}
          <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" aria-label={copy.logLabel} className="flex-1 overflow-y-auto px-4 py-4">
            <ol className="space-y-3">
            {session.messages.map((m, i) => (
              <li key={`${m.at}-${i}`} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[85%]">
                  <p
                    className={
                      m.role === "user"
                        ? "rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-cream"
                        : "rounded-2xl rounded-bl-sm bg-mist px-3.5 py-2.5 text-sm text-ink"
                    }
                  >
                    {m.text}
                  </p>
                  {i === 0 && m.role === "assistant" && (
                    <p className="mt-2 px-1 text-xs text-ink/70">
                      {copy.privacyNote}{" "}
                      <a href={copy.privacyHref} className="underline underline-offset-2 hover:text-primary-deep">
                        {copy.privacyLink}
                      </a>
                    </p>
                  )}
                </div>
              </li>
            ))}
              {pending && (
                <li className="flex justify-start">
                  <p className="rounded-2xl rounded-bl-sm bg-mist px-3.5 py-2.5 text-sm text-ink/70">{copy.typing}</p>
                </li>
              )}
            </ol>
          </div>

          {emergency && (
            <div role="alert" className="border-t border-mist bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-deep">{copy.emergencyTitle}</p>
              <div className="mt-2 flex gap-2">
                {EMERGENCY_NUMBERS.map((n) => (
                  <a
                    key={n.href}
                    href={n.href}
                    className="flex-1 rounded-xl bg-primary px-3 py-3 text-center text-base font-semibold text-cream hover:bg-primary-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {n.label}
                  </a>
                ))}
              </div>
              <button
                type="button"
                onClick={restart}
                className="mt-3 w-full rounded-xl border border-primary/40 px-3 py-2 text-xs font-medium text-primary-deep hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {copy.restart}
              </button>
            </div>
          )}

          {!emergency && form && <ChatFormPanel form={form} lang={lang} pending={pending} onSubmit={(values) => void talk({ action: { kind: "form", formId: form.id, values } })} />}

          {!emergency && !form && (quick.length > 0 || links.length > 0) && (
            <div className="flex flex-wrap gap-2 border-t border-mist px-4 py-3">
              {quick.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onQuick(q)}
                  disabled={pending}
                  className="rounded-full border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary-deep transition hover:bg-mist disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {q.label}
                </button>
              ))}
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="rounded-full bg-mist px-3 py-1.5 text-xs font-medium text-primary-deep hover:bg-mist/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}

          {!emergency && voice && listening !== "idle" && (
            <div role="status" className="border-t border-mist bg-primary/5 px-4 py-2.5">
              <p className="flex items-center gap-2 text-[13px] font-medium text-primary-deep">
                <span className={`inline-block size-2 shrink-0 rounded-full bg-primary ${listening === "hearing" ? "animate-pulse" : ""}`} />
                {listening === "connecting" && copy.voice.connecting}
                {listening === "listening" && copy.voice.listening}
                {listening === "hearing" && copy.voice.hearing}
                {listening === "answering" && copy.voice.answering}
                {listening === "denied" && copy.voice.denied}
                {listening === "error" && copy.voice.error}
              </p>
              {(listening === "listening" || listening === "hearing") && (
                <p className="mt-1 text-[11px] leading-snug text-ink/60">{copy.voice.hint}</p>
              )}
            </div>
          )}

          {!emergency && !form && (
            <div className="flex items-end gap-2 border-t border-mist bg-mist/40 px-3 py-3">
              {voice && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-pressed={listening !== "idle"}
                  aria-label={listening === "idle" ? copy.voice.start : copy.voice.stop}
                  title={listening === "idle" ? copy.voice.start : copy.voice.stop}
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    listening === "idle"
                      ? "border-2 border-primary/25 bg-white text-primary-deep hover:bg-mist"
                      : "bg-primary text-cream hover:bg-primary-deep"
                  }`}
                >
                  <Icon name={listening === "idle" ? "mic" : "mic-off"} size={18} />
                </button>
              )}
              <label htmlFor="site-chat-input" className="sr-only">
                {copy.composerLabel}
              </label>
              <textarea
                id="site-chat-input"
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={600}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitDraft();
                  }
                }}
                placeholder={copy.composerPlaceholder}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border-2 border-primary/25 bg-white px-3 py-2.5 text-sm text-ink shadow-sm transition placeholder:text-ink/60 focus:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              />
              <button
                type="button"
                onClick={submitDraft}
                disabled={pending || draft.trim().length === 0}
                aria-label={copy.send}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-cream transition hover:bg-primary-deep disabled:bg-primary/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Icon name="send" size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Ohne Cockpit oder mit abgeschaltetem Chat: nur Telefon und Sprechzeiten. */
function ChatOffline({ lang, hours }: { lang: ChatLang; hours: string }) {
  const copy = chatCopy[lang];
  return (
    <div className="flex-1 px-4 py-6">
      <p className="text-sm font-semibold text-ink">{copy.offlineTitle}</p>
      <p className="mt-2 text-sm text-ink/80">{copy.offline(hours)}</p>
      <a
        href={site.phoneHref}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-cream hover:bg-primary-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name="phone" size={16} />
        {copy.callLabel}
      </a>
    </div>
  );
}

/** Beschriftete Felder statt Raterei im Fließtext. */
function ChatFormPanel({
  form,
  lang,
  pending,
  onSubmit,
}: {
  form: ChatForm;
  lang: ChatLang;
  pending: boolean;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const copy = chatCopy[lang];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(form.fields.map((f) => [f.name, f.type === "select" ? (f.options?.[0]?.value ?? "") : ""])),
  );
  const [missing, setMissing] = useState<string[]>([]);
  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  const submit = () => {
    const leer = form.fields.filter((f) => f.required && !values[f.name]?.trim()).map((f) => f.name);
    setMissing(leer);
    if (leer.length > 0 || pending) return;
    onSubmit(values);
  };

  return (
    <form
      className="max-h-[55dvh] space-y-3 overflow-y-auto border-t border-mist bg-white/70 px-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="text-sm font-semibold text-ink">{form.title}</p>
      {form.fields.map((f) => {
        const id = `site-chat-${form.id}-${f.name}`;
        const fehlt = missing.includes(f.name);
        const base =
          "w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";
        const border = fehlt ? "border-primary-deep" : "border-mist";
        if (f.type === "checkbox") {
          return (
            <div key={f.name} className="flex items-start gap-2">
              <input
                id={id}
                type="checkbox"
                checked={values[f.name] === "true"}
                aria-invalid={fehlt || undefined}
                onChange={(e) => set(f.name, e.target.checked ? "true" : "")}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
              />
              <label htmlFor={id} className="text-xs text-ink/80">
                {f.label}
                {fehlt && <span className="ml-1 text-primary-deep">({copy.required})</span>}
              </label>
            </div>
          );
        }
        return (
          <div key={f.name}>
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink/80">
              {f.label}
              {fehlt && <span className="ml-1 text-primary-deep">({copy.required})</span>}
            </label>
            {f.type === "select" ? (
              <select id={id} value={values[f.name] ?? ""} aria-invalid={fehlt || undefined} onChange={(e) => set(f.name, e.target.value)} className={`${base} ${border}`}>
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                id={id}
                rows={2}
                maxLength={500}
                value={values[f.name] ?? ""}
                aria-invalid={fehlt || undefined}
                onChange={(e) => set(f.name, e.target.value)}
                className={`${base} ${border} resize-none`}
              />
            ) : (
              <input
                id={id}
                type={f.type}
                value={values[f.name] ?? ""}
                aria-invalid={fehlt || undefined}
                autoComplete={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "off"}
                onChange={(e) => set(f.name, e.target.value)}
                className={`${base} ${border}`}
              />
            )}
          </div>
        );
      })}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-primary-deep disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {form.submit || copy.submit}
      </button>
    </form>
  );
}

/**
 * Einen Antwortsatz abspielen und warten, bis er zu Ende ist. Ein zweiter
 * Satz darf nicht über den ersten laufen – gleichzeitig zu reden ist die
 * schnellste Art, unverständlich zu werden.
 */
async function playOnce(ref: React.RefObject<HTMLAudioElement | null>, blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    const audio = ref.current ?? new Audio();
    ref.current = audio;
    audio.pause();
    audio.src = url;
    await audio.play().catch(() => {});
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      audio.addEventListener("ended", done, { once: true });
      audio.addEventListener("error", done, { once: true });
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
