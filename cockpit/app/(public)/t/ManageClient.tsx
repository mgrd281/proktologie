"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { ManageIcs, ManageView, WaitlistManageView } from "@/lib/booking/public";
import { PRACTICE } from "@/lib/practice";
import { addDays, dateKey, fmtLongDate, fmtShortDate, timeKey } from "@/lib/time";
import { Icon } from "@/components/ui/Icon";

/**
 * Terminverwaltung für Patient:innen – keine Anmeldung, alles in einer Karte:
 * bestätigen bzw. ein Angebot annehmen, verschieben (online nur, wenn die
 * Online-Buchung läuft und die Terminart öffentlich ist – sonst das Telefon),
 * absagen bzw. ablehnen (fragt einmal nach), dazu „In den Kalender“ und
 * „Anfahrt“. Status in Patientenworten; Fehler rot und angesagt, ein
 * ungültiger Link ist etwas anderes als eine gestörte Verbindung.
 */
type View = ManageView | WaitlistManageView;
type Notice = { tone: "ok" | "error"; text: string };
type State = { kind: "loading" } | { kind: "error"; reason: "invalid" | "unreachable"; message: string } | { kind: "ready"; view: View; notice?: Notice };
type Day = { date: string; slots: string[] };

const API = "/api/public/v1";
const TEL = `tel:${PRACTICE.phone.replace(/\s/g, "")}`;
const DIRECTIONS = `${PRACTICE.siteUrl}/#kontakt`;

async function call<T>(body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; status: number; code: string; message: string }> {
  try {
    const res = await fetch(`${API}/manage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } } & Record<string, unknown>;
    if (!res.ok) return { ok: false, status: res.status, code: j.error?.code ?? "error", message: j.error?.message ?? "Etwas ist schiefgelaufen. Bitte versuchen Sie es noch einmal." };
    return { ok: true, data: j as unknown as T };
  } catch {
    return { ok: false, status: 0, code: "network", message: "Keine Verbindung. Bitte versuchen Sie es gleich noch einmal." };
  }
}

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} bg-accent font-semibold text-deep hover:bg-brand-fill-hover`;
const secondary = `${btn} border border-cream/30 text-cream hover:border-accent hover:text-accent`;
const danger = `${btn} border border-red-300/40 text-red-200 hover:bg-red-400/10`;
const quiet = `${btn} px-4 text-cream/85 hover:bg-cream/5 hover:text-accent`;
const link = "font-medium text-accent underline underline-offset-2 hover:no-underline";

/** Datum als Mittag in Berlin – so trifft die Formatierung immer den richtigen Tag. */
const noon = (date: string) => new Date(`${date}T12:00:00Z`);

/** Status in Patientenworten (die Team-Bezeichnungen bleiben im Cockpit). */
function patientStatus(v: ManageView): string {
  if (v.status === "cancelled") {
    if (v.cancelledBy === "system") return "Reservierung abgelaufen";
    if (v.cancelledBy === "patient") return "Abgesagt (durch Sie)";
    if (v.cancelledBy === "praxis") return "Abgesagt (durch die Praxis)";
    return "Abgesagt";
  }
  if (v.status === "completed") return "Stattgefunden";
  if (v.status === "no_show") return "Nicht wahrgenommen";
  if (v.holdUntil) {
    const hold = new Date(v.holdUntil);
    return `Reserviert bis ${fmtShortDate(hold)}, ${timeKey(hold)} Uhr – bitte annehmen`;
  }
  return v.status === "confirmed" ? "Bestätigt" : "Gebucht";
}

function greeting(v: ManageView): string {
  if (v.status === "cancelled") {
    if (v.cancelledBy === "system") return "die Reservierung für diesen Termin ist abgelaufen.";
    if (v.cancelledBy === "patient") return "Sie haben diesen Termin abgesagt.";
    return "dieser Termin wurde abgesagt.";
  }
  if (v.holdUntil) return "wir haben einen Platz für Sie reserviert:";
  // Nichts mehr zu tun: vergangen, wahrgenommen oder nicht wahrgenommen
  if (!v.canCancel) return "hier sind die Angaben zu Ihrem Termin.";
  return v.confirmedByPatient ? "Ihr Termin ist bestätigt." : "hier ist Ihr Termin bei uns.";
}

export function ManageClient() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"idle" | "cancel" | "reschedule" | "withdraw">("idle");
  // Fokus nach dem nächsten Rendern: auf die Meldung oder zurück auf den öffnenden Knopf
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    const t = window.location.hash.replace(/^#/, "").trim();
    setToken(t || null);
  }, []);

  useEffect(() => {
    if (!focusNext.current) return;
    document.querySelector<HTMLElement>(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const load = useCallback(async (t: string) => {
    const a = await call<ManageView>({ token: t, action: "view" });
    if (a.ok) return setState({ kind: "ready", view: a.data });
    if (a.status === 404) {
      const w = await call<WaitlistManageView>({ token: t, action: "view", scope: "waitlist" });
      if (w.ok) return setState({ kind: "ready", view: w.data });
      if (w.status === 404) {
        return setState({ kind: "error", reason: "invalid", message: "Dieser Link ist ungültig oder abgelaufen. Bitte nutzen Sie den Link aus Ihrer aktuellsten E-Mail oder rufen Sie uns an." });
      }
      return setState({ kind: "error", reason: "unreachable", message: w.message });
    }
    setState({ kind: "error", reason: "unreachable", message: a.status === 0 ? "Ihr Termin konnte gerade nicht geladen werden. Bitte prüfen Sie die Internetverbindung und versuchen Sie es noch einmal." : a.message });
  }, []);

  useEffect(() => {
    if (token === null) return;
    void load(token);
  }, [token, load]);

  if (token === null && state.kind === "loading") {
    return (
      <Shell title="Ihr Termin">
        {typeof window !== "undefined" && !window.location.hash ? <p className="text-cream/80">Dieser Link ist unvollständig. Bitte öffnen Sie den vollständigen Link aus Ihrer E-Mail.</p> : <Spinner />}
        {/* Ohne JavaScript kein ewiges „wird geladen“, sondern der Weg übers Telefon */}
        <noscript>
          <style>{"#manage-spinner{display:none}"}</style>
          <p className="text-[15px] leading-relaxed text-cream/85">
            Diese Seite braucht JavaScript. Bestätigen, verschieben oder absagen können Sie Ihren Termin auch telefonisch:{" "}
            <a href={TEL} className={link}>
              {PRACTICE.phone}
            </a>
            .
          </p>
        </noscript>
      </Shell>
    );
  }
  if (state.kind === "loading") return <Shell title="Ihr Termin"><Spinner /></Shell>;
  if (state.kind === "error") {
    return (
      <Shell title={state.reason === "invalid" ? "Link nicht gültig" : "Gerade keine Verbindung"}>
        <p role={state.reason === "unreachable" ? "alert" : undefined} className="text-[15px] leading-relaxed text-cream/85">
          {state.message}
        </p>
        {state.reason === "unreachable" && token && (
          <button
            type="button"
            className={cn(secondary, "mt-5")}
            onClick={() => {
              setState({ kind: "loading" });
              void load(token);
            }}
          >
            <Icon name="refresh" size={16} />
            Erneut versuchen
          </button>
        )}
        <p className="mt-6 text-[14px] text-cream/75">
          Telefonisch erreichen Sie uns unter{" "}
          <a href={TEL} className={link}>
            {PRACTICE.phone}
          </a>
          .
        </p>
      </Shell>
    );
  }

  const v = state.view;
  const notice = state.notice;
  /** Ergebnis melden: grün als Status, rot als Fehler – und den Fokus dorthin. */
  const show = (view: View, n: Notice) => {
    focusNext.current = "#manage-notice";
    setState({ kind: "ready", view, notice: n });
  };
  const act = async (body: Record<string, unknown>, ok: string): Promise<boolean> => {
    if (!token) return false;
    setBusy(true);
    const r = await call<View>({ token, ...body });
    setBusy(false);
    if (!r.ok) {
      show(v, { tone: "error", text: r.message });
      return false;
    }
    setMode("idle");
    show(r.data, { tone: "ok", text: ok });
    return true;
  };
  const back = (opener: string) => {
    focusNext.current = `[data-opens="${opener}"]`;
    setMode("idle");
  };

  const noticeEl = notice && (
    <p
      id="manage-notice"
      tabIndex={-1}
      role={notice.tone === "error" ? "alert" : "status"}
      className={cn("mt-4 flex gap-2 rounded-xl px-4 py-3 text-[14px] leading-relaxed outline-none", notice.tone === "error" ? "border border-red-300/40 bg-red-400/10 text-red-100" : "bg-accent/15 text-cream")}
    >
      <Icon name={notice.tone === "error" ? "alert" : "check"} size={16} className={cn("mt-0.5 shrink-0", notice.tone === "error" ? "text-red-200" : "text-accent")} />
      <span>{notice.text}</span>
    </p>
  );

  if (v.kind === "waitlist") {
    return (
      <Shell title="Ihre Warteliste" eyebrow={v.ref ? `Referenz ${v.ref}` : undefined}>
        <p className="text-[15px] leading-relaxed text-cream/85">
          Guten Tag {v.firstName}, Sie stehen für <span className="font-medium text-cream">{v.typeLabel}</span> auf unserer Warteliste.
        </p>
        <p className="mt-3 text-[14px] text-cream/75">
          Status: <span className="font-medium text-cream">{{ open: "wartend", offered: "Angebot unterwegs", booked: "Termin gebucht", expired: "Angebot abgelaufen", withdrawn: "zurückgezogen" }[v.status]}</span>
        </p>
        {noticeEl}
        {v.canWithdraw && mode !== "withdraw" && (
          <div className="mt-6">
            <button type="button" data-opens="withdraw" className={danger} disabled={busy} onClick={() => setMode("withdraw")}>
              Von der Warteliste streichen
            </button>
          </div>
        )}
        {v.canWithdraw && mode === "withdraw" && (
          <ConfirmBox
            question="Möchten Sie sich wirklich von der Warteliste streichen?"
            detail="Sie bekommen danach keine Angebote mehr für frei werdende Termine."
            confirm="Ja, streichen"
            keep="Nein, auf der Liste bleiben"
            busy={busy}
            onConfirm={() => void act({ action: "withdraw", scope: "waitlist" }, "Sie wurden von der Warteliste gestrichen.")}
            onKeep={() => back("withdraw")}
          />
        )}
        <Footer />
      </Shell>
    );
  }

  const start = new Date(v.startsAt);
  const end = new Date(v.endsAt);
  const isCancelled = v.status === "cancelled";
  const hold = v.holdUntil ? new Date(v.holdUntil) : null;

  const addToCalendar = async () => {
    if (!token) return;
    setBusy(true);
    const r = await call<ManageIcs>({ token, action: "ics" });
    setBusy(false);
    if (!r.ok) return show(v, { tone: "error", text: r.message });
    const url = URL.createObjectURL(new Blob([r.data.ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.data.filename;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    show(v, { tone: "ok", text: "Die Kalenderdatei ist geladen – öffnen Sie sie, um den Termin in Ihren Kalender zu übernehmen." });
  };

  return (
    <Shell title={isCancelled ? (v.cancelledBy === "system" ? "Reservierung abgelaufen" : "Termin abgesagt") : hold ? "Ihr Terminangebot" : "Ihr Termin"} eyebrow={`Referenz ${v.ref}`}>
      <p className="text-[15px] leading-relaxed text-cream/85">
        Guten Tag {v.firstName}, {greeting(v)}
      </p>

      <dl className="mt-5 divide-y divide-cream/10 rounded-xl border border-cream/15 bg-cream/5 px-5">
        {(
          [
            ["Terminart", v.typeLabel],
            ["Datum", fmtLongDate(start)],
            ["Uhrzeit", `${timeKey(start)} – ${timeKey(end)} Uhr`],
            ["Ort", v.address],
            ["Status", patientStatus(v)],
          ] as [string, string][]
        ).map(([k, val]) => (
          <div key={k} className="flex items-baseline justify-between gap-6 py-3">
            <dt className="shrink-0 text-[12px] font-medium tracking-wide text-cream/70 uppercase">{k}</dt>
            <dd className="text-right text-[14px] font-medium text-cream">{val}</dd>
          </div>
        ))}
      </dl>

      {hold && !isCancelled && (
        <p className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-[14px] leading-relaxed text-cream">
          <Icon name="hourglass" size={14} className="mr-1.5 inline text-accent" />
          Reserviert bis {fmtLongDate(hold)}, {timeKey(hold)} Uhr. Mit „Termin annehmen“ wird er verbindlich – danach vergeben wir den Platz weiter.
        </p>
      )}

      {noticeEl}

      {mode === "cancel" && (
        <ConfirmBox
          question={hold ? "Möchten Sie das Angebot ablehnen?" : "Möchten Sie diesen Termin wirklich absagen?"}
          detail={hold ? "Der Termin geht dann an die nächste Person auf der Warteliste, und Ihr Platz auf der Warteliste endet." : undefined}
          confirm={hold ? "Ja, Angebot ablehnen" : "Ja, Termin absagen"}
          keep={hold ? "Nein, zurück" : "Nein, behalten"}
          busy={busy}
          onConfirm={() => void act({ action: "cancel" }, hold ? "Sie haben das Angebot abgelehnt." : "Ihr Termin ist abgesagt. Sie erhalten eine E-Mail zur Bestätigung.")}
          onKeep={() => back("cancel")}
        >
          {v.canReschedule && (
            <button type="button" className={cn(link, "mt-3 inline-flex min-h-11 items-center text-[14px]")} onClick={() => setMode("reschedule")}>
              Lieber verschieben?
            </button>
          )}
          {v.rescheduleByPhone && (
            <p className="mt-3 text-[14px] text-cream/85">
              Lieber verschieben? Rufen Sie uns an:{" "}
              <a href={TEL} className={link}>
                {PRACTICE.phone}
              </a>
            </p>
          )}
        </ConfirmBox>
      )}

      {mode === "reschedule" && v.canReschedule && (
        <Reschedule
          typeId={v.typeId}
          busy={busy}
          onBack={() => back("reschedule")}
          onPick={(date, time) => act({ action: "reschedule", date, time }, "Ihr Termin wurde verschoben. Eine neue Kalenderdatei ist unterwegs.")}
        />
      )}

      {mode === "idle" && !isCancelled && (v.canConfirm || v.canReschedule || v.canCancel) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {v.canConfirm && (
            <button type="button" className={primary} disabled={busy} onClick={() => void act({ action: "confirm" }, hold ? "Vielen Dank – der Termin ist jetzt verbindlich. Die Bestätigung mit Kalenderdatei ist unterwegs." : "Vielen Dank, Ihr Termin ist bestätigt.")}>
              <Icon name="check" size={16} />
              {hold ? "Termin annehmen" : "Termin bestätigen"}
            </button>
          )}
          {v.canReschedule && (
            <button type="button" data-opens="reschedule" className={secondary} disabled={busy} onClick={() => setMode("reschedule")}>
              <Icon name="calendar" size={16} />
              Verschieben
            </button>
          )}
          {v.canCancel && (
            <button type="button" data-opens="cancel" className={danger} disabled={busy} onClick={() => setMode("cancel")}>
              {hold ? "Angebot ablehnen" : "Absagen"}
            </button>
          )}
        </div>
      )}

      {mode === "idle" && v.rescheduleByPhone && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-cream/85">
          <span>Zum Verschieben bitte anrufen:</span>
          <a href={TEL} className={secondary}>
            <Icon name="phone" size={16} />
            {PRACTICE.phone}
          </a>
        </div>
      )}

      {mode === "idle" && !isCancelled && v.canCancel && (
        <div className="mt-4 border-t border-cream/10 pt-3">
          <div className="-ml-4 flex flex-wrap gap-1">
            {v.canAddToCalendar && (
              <button type="button" className={quiet} disabled={busy} onClick={() => void addToCalendar()}>
                <Icon name="download" size={16} />
                In den Kalender
              </button>
            )}
            <a href={DIRECTIONS} target="_blank" rel="noopener" className={quiet}>
              <Icon name="pin" size={16} />
              Anfahrt
              <span className="sr-only">(öffnet die Website der Praxis in einem neuen Tab)</span>
            </a>
          </div>
        </div>
      )}

      {(isCancelled || !v.canCancel) && (
        <p className="mt-6 text-[14px] text-cream/75">
          Einen neuen Termin finden Sie jederzeit auf unserer{" "}
          <a href={`${PRACTICE.siteUrl}/#kontakt`} className={link}>
            Website
          </a>
          .
        </p>
      )}

      <Footer />
    </Shell>
  );
}

function ConfirmBox({ question, detail, confirm, keep, busy, onConfirm, onKeep, children }: { question: string; detail?: string; confirm: string; keep: string; busy: boolean; onConfirm: () => void; onKeep: () => void; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Die Frage bekommt den Fokus – Tastatur und Vorleser landen direkt dort
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1} role="group" aria-labelledby="confirm-question" className="mt-5 rounded-xl border border-red-300/30 bg-red-400/10 p-4 outline-none">
      <p id="confirm-question" className="text-[15px] font-medium text-cream">
        {question}
      </p>
      {detail && <p className="mt-1 text-[14px] leading-relaxed text-cream/85">{detail}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={danger} disabled={busy} onClick={onConfirm}>
          {confirm}
        </button>
        <button type="button" className={secondary} disabled={busy} onClick={onKeep}>
          {keep}
        </button>
      </div>
      {children}
    </div>
  );
}

type Segment = { from: string; to: string };
type SegmentResult = { ok: true; days: Day[]; lastDate: string | null } | { ok: false; message: string };

/**
 * Neuer Zeitpunkt: alle freien Tage der nächsten vier Wochen auf einen Blick,
 * der früheste ist gewählt; „Spätere Tage“ lädt die nächsten vier Wochen bis
 * zum Buchungshorizont. Der Knopf nennt Tag und Uhrzeit.
 */
function Reschedule({ typeId, busy, onBack, onPick }: { typeId: string; busy: boolean; onBack: () => void; onPick: (date: string, time: string) => Promise<boolean> }) {
  const [today] = useState(() => dateKey(new Date()));
  const [segments, setSegments] = useState<Segment[]>(() => [{ from: today, to: addDays(today, 27) }]);
  const [results, setResults] = useState<Record<string, SegmentResult>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [time, setTime] = useState<{ date: string; time: string } | null>(null);
  const inflight = useRef(new Set<string>());
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => panel.current?.focus(), []);

  useEffect(() => {
    for (const s of segments) {
      if (results[s.from] || inflight.current.has(s.from)) continue;
      inflight.current.add(s.from);
      fetch(`${API}/availability?type=${encodeURIComponent(typeId)}&from=${s.from}&to=${s.to}`)
        .then(async (r): Promise<SegmentResult> => {
          const j = (await r.json().catch(() => ({}))) as { days?: Day[]; lastDate?: string | null; error?: { message: string } };
          if (!r.ok) return { ok: false, message: j.error?.message ?? "Die freien Termine konnten gerade nicht geladen werden." };
          return { ok: true, days: j.days ?? [], lastDate: j.lastDate ?? null };
        })
        .catch((): SegmentResult => ({ ok: false, message: "Die freien Termine konnten gerade nicht geladen werden." }))
        .then((r) => {
          inflight.current.delete(s.from);
          setResults((prev) => ({ ...prev, [s.from]: r }));
        });
    }
  }, [segments, results, typeId]);

  const loaded = segments.map((s) => results[s.from]);
  const loading = loaded.some((r) => !r);
  const failure = loaded.find((r): r is Extract<SegmentResult, { ok: false }> => Boolean(r && !r.ok));
  const free = loaded.flatMap((r) => (r?.ok ? r.days.filter((d) => d.slots.length > 0) : []));
  const lastDate = loaded.find((r): r is Extract<SegmentResult, { ok: true }> => Boolean(r?.ok))?.lastDate ?? null;
  const shownUntil = segments[segments.length - 1]?.to ?? today;
  const canLoadMore = !loading && !failure && lastDate !== null && shownUntil < lastDate;

  const date = picked && free.some((d) => d.date === picked) ? picked : (free[0]?.date ?? null);
  const slots = free.find((d) => d.date === date)?.slots ?? [];
  const chosen = time && time.date === date ? time.time : "";
  const morning = slots.filter((s) => s < "12:00");
  const afternoon = slots.filter((s) => s >= "12:00");

  const retry = () => setResults((prev) => Object.fromEntries(Object.entries(prev).filter(([, r]) => r.ok)));
  const more = () => {
    const from = addDays(shownUntil, 1);
    const to = lastDate && addDays(from, 27) > lastDate ? lastDate : addDays(from, 27);
    setSegments((prev) => [...prev, { from, to }]);
  };
  const submit = async () => {
    if (!date || !chosen) return;
    const ok = await onPick(date, chosen);
    // Zeit vergeben oder nicht mehr buchbar → frisch laden, Auswahl zurücksetzen
    if (!ok) {
      setTime(null);
      setResults({});
    }
  };

  const slotButton = (s: string) => (
    <button
      key={s}
      type="button"
      aria-pressed={chosen === s}
      onClick={() => date && setTime({ date, time: s })}
      className={cn("tnum flex min-h-11 items-center justify-center rounded-lg border text-sm font-medium transition-colors", chosen === s ? "border-accent bg-accent text-deep" : "border-cream/20 text-cream hover:border-accent/60")}
    >
      {s}
    </button>
  );

  return (
    <div ref={panel} tabIndex={-1} role="group" aria-labelledby="rs-title" className="mt-5 rounded-xl border border-cream/15 bg-cream/5 p-4 outline-none">
      <p id="rs-title" className="text-[15px] font-medium text-cream">
        Neuen Zeitpunkt wählen
      </p>

      <div className="mt-3">
        {failure ? (
          <div role="alert" className="rounded-lg border border-red-300/40 bg-red-400/10 p-3 text-[14px] text-red-100">
            <p>{failure.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button type="button" className={secondary} onClick={retry}>
                <Icon name="refresh" size={16} />
                Erneut versuchen
              </button>
              <a href={TEL} className={link}>
                {PRACTICE.phone}
              </a>
            </div>
          </div>
        ) : free.length === 0 && loading ? (
          <p role="status" className="text-[14px] text-cream/75">
            Freie Tage werden geladen …
          </p>
        ) : free.length === 0 ? (
          <p role="status" className="text-[14px] text-cream/85">
            Bis {fmtLongDate(noon(shownUntil))} ist online nichts frei.
            {!canLoadMore && (
              <>
                {" "}
                Bitte rufen Sie uns an:{" "}
                <a href={TEL} className={link}>
                  {PRACTICE.phone}
                </a>
              </>
            )}
          </p>
        ) : (
          <>
            <p id="rs-days" className="text-[12px] font-medium tracking-wide text-cream/70 uppercase">
              Freie Tage
            </p>
            <div role="group" aria-labelledby="rs-days" className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {free.map((d) => {
                const [wd, dm] = fmtShortDate(noon(d.date)).split(", "); // "Mo.", "19.10."
                return (
                  <button
                    key={d.date}
                    type="button"
                    aria-pressed={date === d.date}
                    onClick={() => setPicked(d.date)}
                    className={cn("flex min-h-14 flex-col items-center justify-center rounded-lg border leading-tight transition-colors", date === d.date ? "border-accent bg-accent/15 text-cream" : "border-cream/20 text-cream hover:border-accent/60")}
                  >
                    <span className="text-[12px] text-cream/75">{wd}</span>
                    <span className="tnum text-[14px] font-medium">{dm}</span>
                  </button>
                );
              })}
            </div>
            {loading && (
              <p role="status" className="mt-2 text-[13px] text-cream/75">
                Weitere Tage werden geladen …
              </p>
            )}
          </>
        )}
        {canLoadMore && (
          <button type="button" className={cn(quiet, "mt-2 -ml-4")} onClick={more}>
            <Icon name="plus" size={16} />
            Spätere Tage anzeigen
          </button>
        )}
      </div>

      {date && slots.length > 0 && (
        <div className="mt-4">
          <p className="text-[14px] font-medium text-cream">Freie Zeiten am {fmtLongDate(noon(date))}</p>
          {(
            [
              ["Vormittag", morning],
              ["Nachmittag", afternoon],
            ] as const
          )
            .filter(([, list]) => list.length > 0)
            .map(([label, list]) => (
              <div key={label} className="mt-2">
                {morning.length > 0 && afternoon.length > 0 && <p className="mb-1.5 text-[12px] text-cream/75">{label}</p>}
                <div role="group" aria-label={`${label}, ${fmtLongDate(noon(date))}`} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {list.map(slotButton)}
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={cn(primary, "py-2 text-center leading-snug max-sm:w-full")} disabled={busy || !date || !chosen} onClick={() => void submit()}>
          {date && chosen ? `Auf ${fmtShortDate(noon(date))}, ${chosen} Uhr verschieben` : "Bitte Uhrzeit wählen"}
        </button>
        <button type="button" className={cn(secondary, "max-sm:w-full")} disabled={busy} onClick={onBack}>
          Zurück
        </button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <p className="mt-8 text-[12px] leading-relaxed text-cream/70">
      Fragen?{" "}
      <a href={TEL} className="font-medium text-cream underline underline-offset-2 hover:text-accent">
        {PRACTICE.phone}
      </a>{" "}
      · Bitte übermitteln Sie über diese Seite keine medizinischen Details – alles Weitere besprechen wir vertraulich in der Praxis.
    </p>
  );
}

function Shell({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="rise-in w-full max-w-lg rounded-2xl border border-cream/10 bg-deep/60 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur md:p-8" aria-labelledby="manage-title">
      {eyebrow && <p className="mb-2 text-[12px] font-semibold tracking-[0.18em] text-accent uppercase">{eyebrow}</p>}
      <h1 id="manage-title" className="font-display text-[28px] leading-tight font-medium text-cream md:text-[32px]">
        {title}
      </h1>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Spinner() {
  return (
    <p id="manage-spinner" className="flex items-center gap-2 text-[14px] text-cream/75" role="status">
      <Icon name="refresh" size={16} className="motion-safe:animate-spin" /> Termin wird geladen …
    </p>
  );
}
