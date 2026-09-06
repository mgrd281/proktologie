"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { STATUS_LABEL, type AppointmentStatus } from "@/lib/booking/model";
import { PRACTICE } from "@/lib/practice";
import { addDays, dateKey, fmtLongDate, timeKey } from "@/lib/time";
import { Icon } from "@/components/ui/Icon";

/**
 * Terminverwaltung für Patient:innen – drei Handlungen, keine Anmeldung:
 * bestätigen, verschieben, absagen. Alles in einer Karte, jede Aktion mit
 * klarem Ergebnis; Absagen fragt einmal nach.
 */
interface ManageView {
  kind: "appointment";
  ref: string;
  typeId: string;
  typeLabel: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  firstName: string;
  holdUntil: string | null;
  confirmedByPatient: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  address: string;
}
interface WaitlistManageView {
  kind: "waitlist";
  ref: string | null;
  typeLabel: string;
  status: "open" | "offered" | "booked" | "expired" | "withdrawn";
  firstName: string;
  canWithdraw: boolean;
}
type View = ManageView | WaitlistManageView;
type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; view: View; notice?: string };

const API = "/api/public/v1";

async function call<T>(body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; status: number; code: string; message: string }> {
  try {
    const res = await fetch(`${API}/manage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } } & Record<string, unknown>;
    if (!res.ok) return { ok: false, status: res.status, code: j.error?.code ?? "error", message: j.error?.message ?? "Etwas ist schiefgelaufen." };
    return { ok: true, data: j as unknown as T };
  } catch {
    return { ok: false, status: 0, code: "network", message: "Keine Verbindung. Bitte versuchen Sie es gleich noch einmal." };
  }
}

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} bg-accent font-semibold text-deep hover:bg-[#76a81f]`;
const secondary = `${btn} border border-cream/30 text-cream hover:border-accent hover:text-accent`;
const danger = `${btn} border border-red-300/40 text-red-200 hover:bg-red-400/10`;

export function ManageClient() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"idle" | "cancel" | "reschedule">("idle");

  useEffect(() => {
    const t = window.location.hash.replace(/^#/, "").trim();
    setToken(t || null);
  }, []);

  const load = useCallback(async (t: string) => {
    const a = await call<ManageView>({ token: t, action: "view" });
    if (a.ok) return setState({ kind: "ready", view: a.data });
    if (a.status === 404) {
      const w = await call<WaitlistManageView>({ token: t, action: "view", scope: "waitlist" });
      if (w.ok) return setState({ kind: "ready", view: w.data });
      return setState({ kind: "error", message: "Dieser Link ist ungültig oder abgelaufen. Bitte nutzen Sie den Link aus Ihrer aktuellsten E-Mail oder rufen Sie uns an." });
    }
    setState({ kind: "error", message: a.message });
  }, []);

  useEffect(() => {
    if (token === null) return;
    void load(token);
  }, [token, load]);

  if (token === null && state.kind === "loading") {
    return <Shell title="Ihr Termin">{typeof window !== "undefined" && !window.location.hash ? <p className="text-cream/80">Dieser Link ist unvollständig. Bitte öffnen Sie den vollständigen Link aus Ihrer E-Mail.</p> : <Spinner />}</Shell>;
  }
  if (state.kind === "loading") return <Shell title="Ihr Termin"><Spinner /></Shell>;
  if (state.kind === "error") {
    return (
      <Shell title="Link nicht gültig">
        <p className="text-[15px] leading-relaxed text-cream/85">{state.message}</p>
        <p className="mt-6 text-[13px] text-cream/65">
          Telefonisch erreichen Sie uns unter <a href={`tel:${PRACTICE.phone.replace(/\s/g, "")}`} className="font-medium text-accent underline-offset-2 hover:underline">{PRACTICE.phone}</a>.
        </p>
      </Shell>
    );
  }

  const v = state.view;
  const act = async (body: Record<string, unknown>, notice: string) => {
    if (!token) return;
    setBusy(true);
    const r = await call<View>({ token, ...body });
    setBusy(false);
    if (!r.ok) return setState({ kind: "ready", view: v, notice: r.message });
    setMode("idle");
    setState({ kind: "ready", view: r.data, notice });
  };

  if (v.kind === "waitlist") {
    return (
      <Shell title="Ihre Warteliste" eyebrow={v.ref ? `Referenz ${v.ref}` : undefined}>
        <p className="text-[15px] leading-relaxed text-cream/85">
          Guten Tag {v.firstName}, Sie stehen für <span className="font-medium text-cream">{v.typeLabel}</span> auf unserer Warteliste.
        </p>
        <p className="mt-3 text-[14px] text-cream/70">
          Status: <span className="font-medium text-cream">{{ open: "wartend", offered: "Angebot unterwegs", booked: "Termin gebucht", expired: "Angebot abgelaufen", withdrawn: "zurückgezogen" }[v.status]}</span>
        </p>
        {state.notice && <p role="status" className="mt-4 rounded-xl bg-accent/15 px-4 py-3 text-[14px] text-cream">{state.notice}</p>}
        {v.canWithdraw && (
          <div className="mt-6">
            <button type="button" className={danger} disabled={busy} onClick={() => act({ action: "withdraw", scope: "waitlist" }, "Sie wurden von der Warteliste gestrichen.")}>
              Von der Warteliste streichen
            </button>
          </div>
        )}
      </Shell>
    );
  }

  const start = new Date(v.startsAt);
  const end = new Date(v.endsAt);
  const isCancelled = v.status === "cancelled";
  const hold = v.holdUntil ? new Date(v.holdUntil) : null;

  return (
    <Shell title={isCancelled ? "Termin abgesagt" : hold ? "Ihr Terminangebot" : "Ihr Termin"} eyebrow={`Referenz ${v.ref}`}>
      <p className="text-[15px] leading-relaxed text-cream/85">
        Guten Tag {v.firstName},{" "}
        {isCancelled ? "dieser Termin wurde abgesagt." : hold ? "wir haben einen Platz für Sie reserviert:" : v.confirmedByPatient ? "Ihr Termin ist bestätigt." : "hier ist Ihr Termin bei uns."}
      </p>

      <dl className="mt-5 divide-y divide-cream/10 rounded-xl border border-cream/15 bg-cream/5 px-5">
        {(
          [
            ["Terminart", v.typeLabel],
            ["Datum", fmtLongDate(start)],
            ["Uhrzeit", `${timeKey(start)} – ${timeKey(end)} Uhr`],
            ["Ort", v.address],
            ["Status", STATUS_LABEL[v.status]],
          ] as [string, string][]
        ).map(([k, val]) => (
          <div key={k} className="flex items-baseline justify-between gap-6 py-3">
            <dt className="text-[11px] font-medium tracking-wide text-cream/55 uppercase">{k}</dt>
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

      {state.notice && (
        <p role="status" className="mt-4 rounded-xl bg-accent/15 px-4 py-3 text-[14px] text-cream">
          {state.notice}
        </p>
      )}

      {mode === "cancel" && (
        <div className="mt-5 rounded-xl border border-red-300/30 bg-red-400/10 p-4">
          <p className="text-[14px] text-cream">Möchten Sie diesen Termin wirklich absagen?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={danger} disabled={busy} onClick={() => act({ action: "cancel" }, "Ihr Termin ist abgesagt. Sie erhalten eine E-Mail zur Bestätigung.")}>
              Ja, Termin absagen
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={() => setMode("idle")}>
              Nein, behalten
            </button>
          </div>
        </div>
      )}

      {mode === "reschedule" && token && (
        <Reschedule typeId={v.typeId} currentStart={v.startsAt} busy={busy} onCancel={() => setMode("idle")} onPick={(date, time) => act({ action: "reschedule", date, time }, "Ihr Termin wurde verschoben. Eine neue Kalenderdatei ist unterwegs.")} />
      )}

      {mode === "idle" && !isCancelled && (
        <div className="mt-6 flex flex-wrap gap-2">
          {v.canConfirm && (
            <button type="button" className={primary} disabled={busy} onClick={() => act({ action: "confirm" }, hold ? "Vielen Dank – der Termin ist jetzt verbindlich. Die Bestätigung mit Kalenderdatei ist unterwegs." : "Vielen Dank, Ihr Termin ist bestätigt.")}>
              <Icon name="check" size={16} />
              {hold ? "Termin annehmen" : "Termin bestätigen"}
            </button>
          )}
          {v.canReschedule && (
            <button type="button" className={secondary} disabled={busy} onClick={() => setMode("reschedule")}>
              <Icon name="calendar" size={16} />
              Verschieben
            </button>
          )}
          {v.canCancel && (
            <button type="button" className={danger} disabled={busy} onClick={() => setMode("cancel")}>
              Absagen
            </button>
          )}
        </div>
      )}

      {isCancelled && (
        <p className="mt-6 text-[14px] text-cream/75">
          Einen neuen Termin finden Sie jederzeit auf unserer{" "}
          <a href={`${PRACTICE.siteUrl}/#kontakt`} className="font-medium text-accent underline-offset-2 hover:underline">
            Website
          </a>
          .
        </p>
      )}

      <p className="mt-8 text-[12px] leading-relaxed text-cream/55">
        Fragen? {PRACTICE.phone} · Bitte übermitteln Sie über diese Seite keine medizinischen Details – alles Weitere besprechen wir vertraulich in der Praxis.
      </p>
    </Shell>
  );
}

function Reschedule({ typeId, currentStart, busy, onCancel, onPick }: { typeId: string; currentStart: string; busy: boolean; onCancel: () => void; onPick: (date: string, time: string) => void }) {
  const today = dateKey(new Date());
  const [date, setDate] = useState(dateKey(new Date(currentStart)) > today ? dateKey(new Date(currentStart)) : addDays(today, 1));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    setTime("");
    setErr(null);
    fetch(`${API}/availability?type=${encodeURIComponent(typeId)}&from=${date}&to=${date}`)
      .then(async (r) => {
        const j = (await r.json()) as { days?: Array<{ date: string; slots: string[] }>; error?: { message: string } };
        if (!alive) return;
        if (!r.ok) return setErr(j.error?.message ?? "Verfügbarkeit konnte nicht geladen werden.");
        setSlots(j.days?.find((d) => d.date === date)?.slots ?? []);
      })
      .catch(() => alive && setErr("Keine Verbindung."));
    return () => {
      alive = false;
    };
  }, [typeId, date]);

  return (
    <div className="mt-5 rounded-xl border border-cream/15 bg-cream/5 p-4">
      <p className="text-[14px] font-medium text-cream">Neuen Zeitpunkt wählen</p>
      <label className="mt-3 block text-[12px] text-cream/70" htmlFor="rs-date">
        Datum
      </label>
      <input id="rs-date" type="date" min={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="tnum mt-1 min-h-11 w-full rounded-xl border border-cream/20 bg-deep px-4 text-cream" />
      <div className="mt-3" aria-live="polite">
        {err && <p className="text-[13px] text-red-200">{err}</p>}
        {!err && slots === null && <p className="text-[13px] text-cream/60">Freie Zeiten werden geladen …</p>}
        {!err && slots && slots.length === 0 && <p className="text-[13px] text-cream/60">An diesem Tag ist nichts frei – bitte einen anderen Tag wählen.</p>}
        {!err && slots && slots.length > 0 && (
          <div role="group" aria-label={`Freie Zeiten am ${fmtLongDate(new Date(`${date}T12:00:00Z`))}`} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={time === s}
                onClick={() => setTime(s)}
                className={cn("tnum flex min-h-11 items-center justify-center rounded-lg border text-sm font-medium transition-colors", time === s ? "border-accent bg-accent text-deep" : "border-cream/20 text-cream hover:border-accent/60")}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={busy || !time} onClick={() => time && onPick(date, time)}>
          Auf {time || "…"} Uhr verschieben
        </button>
        <button type="button" className={secondary} disabled={busy} onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function Shell({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="rise-in w-full max-w-lg rounded-2xl border border-cream/10 bg-deep/60 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur md:p-8" aria-labelledby="manage-title">
      {eyebrow && <p className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">{eyebrow}</p>}
      <h1 id="manage-title" className="font-display text-[28px] leading-tight font-medium text-cream md:text-[32px]">
        {title}
      </h1>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Spinner() {
  return (
    <p className="flex items-center gap-2 text-[14px] text-cream/70" role="status">
      <Icon name="refresh" size={16} className="animate-spin" /> Termin wird geladen …
    </p>
  );
}
