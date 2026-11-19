import { Fragment, useEffect, useState } from "react";
import { CheckCircle2, Download, FileWarning, Gauge, Gavel, ListChecks, Loader2, MessageSquarePlus, Pencil, ShieldX, Undo2 } from "lucide-react";
import { api, ApiError, downloadBlob } from "../api/client";
import type { Confidence, Memo, RunOut } from "../api/types";
import { findSource, scrollToSource, type SourceItem } from "../lib/sources";
import { errMsg, fmtDate } from "../util";
import { CheckBadge } from "./StatusBadge";

const SECTIONS: { key: "question_presented" | "issue" | "rule" | "application" | "conclusion"; title: string }[] = [
  { key: "question_presented", title: "Question Presented" },
  { key: "issue", title: "Issue" },
  { key: "rule", title: "Rule" },
  { key: "application", title: "Application" },
  { key: "conclusion", title: "Conclusion" },
];

/** Minimal inline markdown used by the memo drafter: **bold** and *italic*. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (/^\*[^*\n]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function WithMarkers({ text, memo, items }: { text: string; memo: Memo; items: SourceItem[] }) {
  return (
    <>
      {text.split(/(\[\d+\])/g).map((part, i) => {
        const cit = /^\[\d+\]$/.test(part) ? memo.citations.find((c) => c.marker === part) : undefined;
        if (!cit) return <Inline key={i} text={part} />;
        const src = findSource(items, cit);
        return (
          <button key={i} type="button"
            className="mx-0.5 rounded-md bg-amber-bg px-1.5 py-px align-[1px] font-sans text-[11.5px] font-bold text-amber-dark ring-1 ring-[#f4d58c] hover:bg-amber hover:text-navy"
            title={`${cit.case_name || cit.citation} - ${cit.citation}. Click to show the source card.`}
            onClick={() => src && scrollToSource(src.key)} disabled={!src}>
            {part}
          </button>
        );
      })}
    </>
  );
}

const PART_LABEL: Record<string, string> = {
  verification: "Citations verified with no warning",
  authority: "Case authorities binding on the court",
  coverage: "Plan issues supported by an authority",
  retrieval: "Search relevance of the authorities",
};
const PART_WEIGHT: Record<string, number> = { verification: 35, authority: 25, coverage: 25, retrieval: 15 };

export function ConfidenceCard({ c }: { c: Confidence }) {
  const tone = c.level === "High" ? "#16a34a" : c.level === "Medium" ? "#f5a623" : "#dc2626";
  const deg = Math.round(Math.max(0, Math.min(1, c.score)) * 360);
  return (
    <section className="card" aria-label="Memo confidence">
      <div className="card-h"><h2><Gauge size={16} aria-hidden="true" />Confidence</h2><span className="text-xs font-normal text-muted">how much checking this memo needs</span></div>
      <div className="card-b flex flex-wrap items-center gap-5">
        <div className="relative grid h-24 w-24 flex-none place-items-center rounded-full" style={{ background: `conic-gradient(${tone} ${deg}deg, #e6eaf1 0deg)` }}
          role="img" aria-label={`Confidence ${c.level}, ${c.score.toFixed(2)}`}>
          <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-xl font-extrabold leading-none text-navy">{c.score.toFixed(2)}</span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: tone }}>{c.level}</span>
          </div>
        </div>
        <ul className="min-w-[240px] flex-1 space-y-2">
          {Object.keys(PART_LABEL).map((k) => {
            const v = c.components[k] ?? 0;
            return (
              <li key={k} className="text-xs">
                <div className="flex justify-between gap-2"><span className="text-ink">{PART_LABEL[k]} <span className="text-muted">({PART_WEIGHT[k]}%)</span></span><span className="font-semibold tabular-nums text-navy">{v.toFixed(2)}</span></div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#e6eaf1]"><div className="h-full rounded-full bg-navy-3" style={{ width: `${Math.round(v * 100)}%` }} /></div>
              </li>
            );
          })}
        </ul>
        {c.notes.length > 0 && <ul className="w-full space-y-1 text-xs text-amber-dark">{c.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>}
      </div>
    </section>
  );
}

export default function MemoEditor({ run, memo, items, isAttorney, onView, onChanged }: {
  run: RunOut; memo: Memo; items: SourceItem[]; isAttorney: boolean; onView: (i: SourceItem) => void; onChanged: () => void;
}) {
  const awaiting = run.status === "awaiting_memo_approval";
  const canEdit = awaiting && isAttorney;
  const [draft, setDraft] = useState<Memo>(memo);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState<ApiError | string | null>(null);
  const [asking, setAsking] = useState(false);
  const [instr, setInstr] = useState("");

  useEffect(() => { if (!editing) setDraft(memo); }, [memo, editing]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(memo);
  const approved = run.status === "approved" || run.status === "exported";

  async function approve() {
    setBusy("approve");
    setErr(null);
    try { await api.approveMemo(run.id, dirty ? draft : undefined); setEditing(false); onChanged(); }
    catch (e) { setErr(e instanceof ApiError ? e : errMsg(e)); } finally { setBusy(""); }
  }
  async function changes() {
    setBusy("changes");
    setErr(null);
    try { await api.requestChanges(run.id, instr.trim()); setAsking(false); setInstr(""); onChanged(); }
    catch (e) { setErr(e instanceof ApiError ? e : errMsg(e)); } finally { setBusy(""); }
  }
  async function exportDocx() {
    setBusy("export");
    setErr(null);
    try { downloadBlob(await api.exportDocx(run.id), `STARE-memo-run-${run.id}.docx`); onChanged(); }
    catch (e) { setErr(e instanceof ApiError ? e : errMsg(e)); } finally { setBusy(""); }
  }

  const exportReason = !isAttorney ? "Only an attorney can export the memo."
    : !approved ? "Export unlocks after an attorney approves the memo." : "";
  const counts = memo.citations.reduce((a, c) => ({ ...a, [c.status]: (a[c.status] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* actions */}
      <div className="card flex flex-wrap items-center gap-2 px-4 py-3" role="group" aria-label="Memo actions">
        {approved ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-ok"><CheckCircle2 size={17} aria-hidden="true" />Approved by the attorney{run.memo_approved_at ? `, ${fmtDate(run.memo_approved_at)}` : ""}</span>
        ) : awaiting ? (
          <span className="font-semibold text-navy">{isAttorney ? "Review the memo, then approve it or ask for changes." : "Read-only: waiting for attorney review."}</span>
        ) : null}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit && !editing && <button className="btn" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" />Edit</button>}
          {canEdit && editing && <button className="btn" onClick={() => { setDraft(memo); setEditing(false); }}><Undo2 size={14} aria-hidden="true" />Discard edits</button>}
          {canEdit && <button className="btn" onClick={() => setAsking((a) => !a)} aria-expanded={asking}><MessageSquarePlus size={14} aria-hidden="true" />Request changes</button>}
          {canEdit && (
            <button className="btn btn-amber" disabled={busy !== ""} onClick={approve}>
              {busy === "approve" ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
              {busy === "approve" ? "Verifying..." : dirty ? "Approve edited memo" : "Approve memo"}
            </button>
          )}
          <span title={exportReason}>
            <button className="btn btn-primary" disabled={!!exportReason || busy !== ""} onClick={exportDocx} aria-describedby="export-why">
              {busy === "export" ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
              {busy === "export" ? "Exporting..." : "Export DOCX"}
            </button>
          </span>
        </span>
        {exportReason && <span id="export-why" className="w-full text-right text-xs text-muted">{exportReason}</span>}
        {asking && canEdit && (
          <div className="mt-1 w-full space-y-2 border-t border-line pt-3">
            <label className="label" htmlFor="chg">What should change?</label>
            <textarea id="chg" className="input" rows={3} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="e.g. Add Fifth Circuit authority on the but-for causation standard" />
            <button className="btn btn-primary btn-sm" disabled={!instr.trim() || busy !== ""} onClick={changes}>{busy === "changes" ? "Sending..." : "Send to the Memo Agent"}</button>
          </div>
        )}
      </div>

      {err && (
        <div className="alert alert-bad" role="alert">
          <p className="font-semibold">{typeof err === "string" ? err : err.message}</p>
          {typeof err !== "string" && err.problems.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-[13px]">{err.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
          )}
          {typeof err !== "string" && err.status === 422 && <p className="mt-1 text-xs">Edited citations must pass the Citation Firewall. Remove or correct them and try again.</p>}
        </div>
      )}

      {memo.confidence && <ConfidenceCard c={memo.confidence} />}

      {/* the memo itself, laid out like a document */}
      <article className="card overflow-hidden" aria-label="Research memo">
        <header className="border-b border-line bg-[#fbfcfe] px-6 py-4 md:px-10">
          <div className="eyebrow">Research memorandum · privileged and confidential</div>
          <h2 className="mt-1 font-serif text-xl font-bold leading-snug text-navy">{memo.title || "Research memo"}</h2>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {run.memo_version != null && <span>Draft v{run.memo_version}</span>}
            <span>Drafted by {memo.generated_by}</span>
            <span>{memo.citations.length} citations: {counts.verified ?? 0} verified{counts.warning ? `, ${counts.warning} with a warning` : ""}{counts.blocked ? `, ${counts.blocked} blocked` : ""}</span>
          </p>
        </header>
        <div className="space-y-6 px-6 py-6 md:px-10">
          {SECTIONS.map((s) => (
            <section key={s.key}>
              <h3 className="mb-1.5 border-b border-line pb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-navy-3">{s.title}</h3>
              {editing ? (
                <textarea aria-label={s.title} className="input legal" rows={s.key === "application" || s.key === "rule" ? 10 : 4}
                  value={draft[s.key]} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} />
              ) : (
                <p className="legal whitespace-pre-wrap text-ink"><WithMarkers text={memo[s.key]} memo={memo} items={items} /></p>
              )}
            </section>
          ))}
          {editing && <p className="alert alert-info text-xs">Citation markers like [1] refer to the numbered references below. Any new or changed citation is re-checked by the Citation Firewall when you approve.</p>}
        </div>
        <footer className="border-t border-line bg-[#fbfcfe] px-6 py-4 md:px-10">
          <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-navy-3"><ListChecks size={14} aria-hidden="true" />References</h3>
          {memo.citations.length === 0 ? <p className="text-muted">No citations in this memo.</p> : (
            <ol className="divide-y divide-line">
              {memo.citations.map((c) => {
                const src = findSource(items, c);
                return (
                  <li key={c.marker} className="flex flex-wrap items-center gap-2 py-1.5 text-[13px]">
                    <span className="w-8 font-bold text-amber-dark">{c.marker}</span>
                    <CheckBadge status={c.status} />
                    <span className="min-w-0 flex-1"><i className="font-serif text-[14px]">{c.case_name}</i> <span className="font-mono text-xs text-muted">{c.citation}</span></span>
                    {src && <button className="btn btn-sm" onClick={() => scrollToSource(src.key)}>Source</button>}
                    {src?.opinionId != null && <button className="btn btn-sm" onClick={() => onView(src)}>Opinion</button>}
                    {c.url && <a className="text-xs text-navy underline" href={c.url} target="_blank" rel="noreferrer">Link</a>}
                  </li>
                );
              })}
            </ol>
          )}
        </footer>
      </article>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card" aria-label="Adverse authority report">
          <div className="card-h"><h2><Gavel size={16} aria-hidden="true" />Adverse authority</h2><span className="chip chip-bad">Opposing Counsel</span></div>
          <p className="card-b legal whitespace-pre-wrap !text-[14.5px]">
            {memo.adverse_authority ? <WithMarkers text={memo.adverse_authority} memo={memo} items={items} /> : <span className="text-muted">No adverse authority was found.</span>}
          </p>
        </section>
        <div className="space-y-4">
          <section className="card" aria-label="Firewall warnings">
            <div className="card-h"><h2><FileWarning size={16} aria-hidden="true" />Firewall warnings</h2><span className="chip chip-warn">{memo.warnings.length}</span></div>
            <div className="card-b">
              {memo.warnings.length === 0 ? <p className="text-muted">No warnings.</p> : (
                <ul className="space-y-1.5">{memo.warnings.map((w, i) => <li key={i} className="alert alert-warn text-[13px]"><strong>Warning: </strong>{w}</li>)}</ul>
              )}
            </div>
          </section>
          <section className="card" aria-label="Removed by the Citation Firewall">
            <div className="card-h"><h2><ShieldX size={16} aria-hidden="true" />Removed by the Citation Firewall</h2><span className="chip chip-bad">{memo.removed_citations.length}</span></div>
            <div className="card-b">
              {memo.removed_citations.length === 0 ? <p className="text-muted">Nothing was removed.</p> : (
                <ul className="space-y-1.5">{memo.removed_citations.map((w, i) => <li key={i} className="alert alert-bad text-[13px]"><strong>Removed: </strong>{w}</li>)}</ul>
              )}
            </div>
          </section>
        </div>
      </div>
      {memo.disclaimer && <p className="text-xs italic text-muted">{memo.disclaimer}</p>}
    </div>
  );
}
