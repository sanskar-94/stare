import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Briefcase, ChevronRight, FileCheck2, Library, Plus, Search, X } from "lucide-react";
import { api } from "../api/client";
import type { Court, MatterSummary } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useServerStatus } from "../hooks/useServerStatus";
import { RunStatusPill, runStatusInfo } from "../components/StatusBadge";
import { EmptyState, ErrorBox, Loading, PageHeader } from "../components/Spinner";
import { claimLabel, errMsg, fmtAgo, fmtDay } from "../util";

function CourtSelect({ courts, value, onChange }: { courts: Court[]; value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return courts.filter((c) => !s || c.name.toLowerCase().includes(s) || c.short_name.toLowerCase().includes(s) || c.id.includes(s)).slice(0, 300);
  }, [courts, q]);
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input className="input !pl-8" placeholder="Search courts (e.g. N.D. Tex., Fifth Circuit)" aria-label="Search courts" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <select className="input" aria-label="Court" value={value} onChange={(e) => onChange(e.target.value)} size={1}>
        <option value="">Court not yet known (read from the complaint)</option>
        {list.map((c) => (
          <option key={c.id} value={c.id}>{c.short_name} - {c.name}{c.circuit ? ` (Circuit ${c.circuit})` : ""}</option>
        ))}
      </select>
      <p className="text-xs text-muted">{list.length} of {courts.length} federal courts shown</p>
    </div>
  );
}

function NewMatterDialog({ courts, onClose }: { courts: Court[]; onClose: () => void }) {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [court, setCourt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const m = await api.createMatter({ title: title.trim(), court_id: court || null, notes });
      nav(`/matters/${m.id}`);
    } catch (x) { setErr(errMsg(x)); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="nm-title">
      <div className="absolute inset-0 bg-navy/45 backdrop-blur-[2px]" onClick={onClose} />
      <form onSubmit={create} className="card relative w-full max-w-2xl shadow-2xl" aria-label="New matter">
        <div className="card-h">
          <h2 id="nm-title"><Briefcase size={16} aria-hidden="true" />New matter</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="card-b grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="mt">Title</label>
              <input id="mt" className="input" required autoFocus maxLength={300} placeholder="e.g. Retaliation claim - warehouse supervisor" value={title} onChange={(e) => setTitle(e.target.value)} />
              <p className="mt-1 text-xs text-muted">Do not enter client names: personal details are redacted from uploaded documents, not from titles.</p>
            </div>
            <div>
              <label className="label" htmlFor="nt">Notes</label>
              <textarea id="nt" className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div>
            <span className="label">Court</span>
            <CourtSelect courts={courts} value={court} onChange={setCourt} />
          </div>
        </div>
        {err && <div className="px-4 pb-2"><ErrorBox message={err} /></div>}
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !title.trim()}>{busy ? "Creating..." : "Create matter"}</button>
        </div>
      </form>
    </div>
  );
}

function Stat({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: React.ReactNode; label: string }) {
  return (
    <div className="card stat">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <span>
        <span className="stat-value block">{value}</span>
        <span className="stat-label">{label}</span>
      </span>
    </div>
  );
}

type Filter = "all" | "active" | "done";
const DONE = ["exported", "approved"];

export default function Matters() {
  const { isRole } = useAuth();
  const { health } = useServerStatus();
  const nav = useNavigate();
  const [matters, setMatters] = useState<MatterSummary[] | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const canCreate = isRole("attorney", "paralegal");

  useEffect(() => {
    api.matters().then(setMatters).catch((e) => setErr(errMsg(e)));
    api.courts().then(setCourts).catch(() => {});
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (matters ?? []).filter((m) => {
      if (filter === "active" && (!m.last_run_status || DONE.includes(m.last_run_status))) return false;
      if (filter === "done" && !DONE.includes(m.last_run_status ?? "")) return false;
      return !s || [m.title, m.matter_number, m.court_name ?? "", ...m.claims.map(claimLabel)].join(" ").toLowerCase().includes(s);
    });
  }, [matters, q, filter]);

  const active = (matters ?? []).filter((m) => m.last_run_status && !DONE.includes(m.last_run_status)).length;
  const exported = (matters ?? []).filter((m) => m.last_run_status === "exported").length;

  return (
    <div className="space-y-5">
      <PageHeader icon={<Briefcase size={20} />} title="Matters" sub="Each matter holds the client's documents and its research runs."
        actions={canCreate && <button className="btn btn-amber" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" />New matter</button>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Briefcase size={19} />} tone="bg-navy/10 text-navy" value={matters?.length ?? "-"} label="Matters" />
        <Stat icon={<Activity size={19} />} tone="bg-amber-bg text-amber-dark" value={matters ? active : "-"} label="Runs in progress or awaiting approval" />
        <Stat icon={<FileCheck2 size={19} />} tone="bg-ok-bg text-ok" value={matters ? exported : "-"} label="Memos approved and exported" />
        <Stat icon={<Library size={19} />} tone="bg-sky-50 text-sky-700" value={health?.corpus?.opinions?.toLocaleString() ?? "-"}
          label={`Federal opinions indexed${health?.corpus?.statutes ? `, plus ${health.corpus.statutes} statute sections` : ""}`} />
      </div>

      {err && <ErrorBox message={err} />}

      {!matters ? (err ? null : <Loading text="Loading matters..." />) : matters.length === 0 ? (
        <EmptyState icon={<Briefcase size={22} />} title="No matters yet">
          {canCreate ? (
            <>
              Create a matter, upload a complaint or EEOC charge, approve the research plan, and STARE drafts a verified IRAC memo.
              <div className="mt-4"><button className="btn btn-amber" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" />New matter</button></div>
            </>
          ) : "An attorney or paralegal creates matters."}
        </EmptyState>
      ) : (
        <section className="card overflow-hidden" aria-label="Matter list">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input className="input !pl-8" placeholder="Search by title, number, court or claim" aria-label="Search matters" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="seg" role="tablist" aria-label="Filter matters">
              {([["all", "All"], ["active", "In progress"], ["done", "Exported"]] as [Filter, string][]).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
            <span className="ml-auto text-xs text-muted">{shown.length} of {matters.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Matter</th><th className="th">Court</th><th className="th">Claims</th><th className="th">Docs</th><th className="th">Latest run</th><th className="th">Created</th><th className="th" aria-label="Open" /></tr></thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className="cursor-pointer transition-colors hover:bg-[#f8fafd]" onClick={() => nav(`/matters/${m.id}`)}>
                    <td className="td">
                      <Link className="font-mono text-xs font-semibold text-navy-3 hover:underline" to={`/matters/${m.id}`} onClick={(e) => e.stopPropagation()}>{m.matter_number}</Link>
                      <span className="block font-semibold text-navy">{m.title}</span>
                    </td>
                    <td className="td max-w-[260px]">{m.court_name ?? <span className="text-muted">not set</span>}</td>
                    <td className="td"><div className="flex flex-wrap gap-1">{m.claims.length ? m.claims.map((c, i) => <span key={i} className="chip chip-navy">{claimLabel(c)}</span>) : <span className="text-muted">-</span>}</div></td>
                    <td className="td">{m.document_count}</td>
                    <td className="td">{m.last_run_status ? <RunStatusPill status={m.last_run_status} /> : <span className="text-muted">none</span>}</td>
                    <td className="td whitespace-nowrap text-muted">{fmtDay(m.created_at)}<span className="block text-xs">{fmtAgo(m.created_at)}</span></td>
                    <td className="td text-muted"><ChevronRight size={16} aria-hidden="true" /></td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td className="td text-muted" colSpan={7}>No matters match.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {open && <NewMatterDialog courts={courts} onClose={() => setOpen(false)} />}
      {matters && matters.some((m) => runStatusInfo(m.last_run_status ?? "").busy) && <p className="sr-only" role="status">Some runs are in progress.</p>}
    </div>
  );
}
