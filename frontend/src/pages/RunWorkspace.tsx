import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Clock, FileText, LayoutDashboard, Network, XCircle } from "lucide-react";
import { api } from "../api/client";
import type { Court, MatterDetail, RunOut, TraceEvent } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useRunEvents } from "../hooks/useRunEvents";
import { buildSources, findSource, scrollToSource, type SourceItem } from "../lib/sources";
import { buildTrace, mergeStep, pipeline } from "../lib/trace";
import AgentTraceCard from "../components/AgentTraceCard";
import CaseFileCard from "../components/CaseFileCard";
import MemoEditor from "../components/MemoEditor";
import OpinionDrawer from "../components/OpinionDrawer";
import PipelineStrip from "../components/PipelineStrip";
import PlanEditor from "../components/PlanEditor";
import PrecedentGraph from "../components/PrecedentGraph";
import SourcesPanel from "../components/SourcesPanel";
import { RunStatusPill, runStatusInfo } from "../components/StatusBadge";
import { ErrorBox, Loading } from "../components/Spinner";
import { claimLabel, errMsg, tsMs } from "../util";

type View = "workspace" | "memo" | "graph";
const TARGET_S = 90;

export default function RunWorkspace() {
  const id = Number(useParams().id);
  const { isRole } = useAuth();
  const isAttorney = isRole("attorney");
  const canEditCase = isRole("attorney", "paralegal");

  const [run, setRun] = useState<RunOut | null>(null);
  const [matter, setMatter] = useState<MatterDetail | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [err, setErr] = useState("");
  const [view, setView] = useState<View>("workspace");
  const [drawer, setDrawer] = useState<{ opinionId: number; quote: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const autoSwitched = useRef(false);

  const refresh = useCallback(async () => {
    try { setRun(await api.run(id)); setErr(""); } catch (e) { setErr(errMsg(e)); }
  }, [id]);

  useEffect(() => { setRun(null); autoSwitched.current = false; refresh(); }, [refresh]);
  useEffect(() => { api.courts().then(setCourts).catch(() => {}); }, []);
  useEffect(() => {
    if (run?.case_id != null && matter?.id !== run.case_id) api.matter(run.case_id).then(setMatter).catch(() => {});
  }, [run?.case_id, matter?.id]);

  useRunEvents(id, {
    onTrace: (e: TraceEvent) => setRun((r) => (r ? { ...r, steps: mergeStep(r.steps, e) } : r)),
    onStatus: (s) => { setRun((r) => (r ? { ...r, status: s as RunOut["status"] } : r)); refresh(); },
    onOpen: refresh,
  });

  const busy = run ? runStatusInfo(run.status).busy : false;
  const anyRunning = !!run?.steps.length && buildTrace(run.steps).some((r) => r.status === "running");
  useEffect(() => {
    if (!busy && !anyRunning) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [busy, anyRunning]);
  // safety net if the event stream drops
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  const hasMemo = !!run?.memo && ["awaiting_memo_approval", "approved", "exported"].includes(run.status);
  useEffect(() => {
    if (hasMemo && !autoSwitched.current) { autoSwitched.current = true; setView("memo"); }
    if (!hasMemo && view === "memo") setView("workspace");
  }, [hasMemo, view]);

  const items = useMemo(() => buildSources(run), [run]);
  const trace = useMemo(() => buildTrace(run?.steps ?? []), [run?.steps]);
  const openOpinion = useCallback((i: SourceItem) => { if (i.opinionId != null) setDrawer({ opinionId: i.opinionId, quote: i.quote }); }, []);

  if (!run) return err ? <ErrorBox message={err} /> : <Loading text="Loading research run..." />;

  const rec = run.case_record;
  const runNo = matter ? [...matter.runs].sort((a, b) => a.id - b.id).findIndex((r) => r.id === run.id) + 1 : undefined;
  const plaintiff = rec?.parties.find((p) => p.role === "plaintiff")?.name ?? "[PLAINTIFF]";
  const defendant = rec?.parties.find((p) => p.role === "defendant")?.name;

  // elapsed / target (counted from plan approval)
  const approvedMs = tsMs(run.plan_approved_at);
  const finished = ["awaiting_memo_approval", "approved", "exported", "failed", "cancelled"].includes(run.status);
  let elapsed = 0;
  if (approvedMs != null) {
    if (finished && run.latency_ms != null) elapsed = run.latency_ms / 1000;
    else if (finished) {
      const lastEnd = Math.max(0, ...run.steps.map((s) => tsMs(s.ended_at) ?? 0));
      elapsed = Math.max(0, (lastEnd - approvedMs) / 1000);
    } else elapsed = Math.max(0, (now - approvedMs) / 1000);
  }
  const pct = Math.min(100, (elapsed / TARGET_S) * 100);
  const loops = trace.find((t) => t.agent === "research")?.runs ?? 0;
  const awaitingPlan = run.status === "awaiting_plan_approval";
  const stages = pipeline(run, trace);

  const tabs: [View, string, boolean, React.ReactNode][] = [
    ["workspace", "Research workspace", true, <LayoutDashboard size={15} key="w" />],
    ["memo", "Memo", hasMemo, <FileText size={15} key="m" />],
    ["graph", "Precedent graph", true, <Network size={15} key="g" />],
  ];
  const sources = <SourcesPanel items={items} onView={openOpinion} />;

  return (
    <div className="space-y-4">
      <Link to={`/matters/${run.case_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-navy">
        <ChevronLeft size={15} aria-hidden="true" />{matter ? `${matter.matter_number}: ${matter.title}` : "Back to the matter"}
      </Link>

      {/* summary and pipeline */}
      <section className="card">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <div className="eyebrow">{matter?.matter_number ?? `Matter ${run.case_id}`}{runNo ? ` · run ${runNo}` : ""}</div>
            <h1 className="truncate text-lg font-bold text-navy">{matter?.title ?? "Research run"}</h1>
          </div>
          <div className="text-[13px]">
            <span className="label !mb-0">Parties</span>
            <span className="ph">{plaintiff}</span> <span className="text-muted">v.</span> {defendant ?? "-"}
          </div>
          <div className="text-[13px]">
            <span className="label !mb-0">Court</span>
            {rec?.court_name ?? "Not identified"}{rec?.circuit ? <span className="text-muted"> (Circuit {rec.circuit})</span> : ""}
          </div>
          <div className="text-[13px]">
            <span className="label !mb-0">Claims</span>
            <span className="flex flex-wrap gap-1">{rec?.claims.length ? rec.claims.map((c, i) => <span key={i} className="chip chip-navy">{claimLabel(c)}</span>) : "-"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <RunStatusPill status={run.status} large />
            {isAttorney && (busy || awaitingPlan || run.status === "awaiting_memo_approval") && (
              <button className="btn btn-sm btn-danger" onClick={async () => { if (confirm("Cancel this run?")) { try { await api.cancelRun(id); refresh(); } catch (e) { setErr(errMsg(e)); } } }}>
                <XCircle size={14} aria-hidden="true" />Cancel run
              </button>
            )}
          </div>
        </div>
        <div className="border-t border-line bg-[#fbfcfe] px-4 pb-2.5 pt-3 rounded-b-xl">
          <PipelineStrip stages={stages} />
        </div>
      </section>
      {err && <ErrorBox message={err} />}
      {run.status === "failed" && <div className="alert alert-bad" role="alert"><strong>Run failed.</strong> {run.error ?? "An unexpected error occurred."}</div>}

      {/* view tabs */}
      <div role="tablist" aria-label="Workspace views" className="flex gap-1 border-b border-line">
        {tabs.filter((t) => t[2]).map(([k, label, , icon]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2 font-semibold transition-colors ${view === k ? "border-amber text-navy" : "border-transparent text-muted hover:text-navy"}`}>
            {icon}{label}
            {k === "memo" && run.status === "awaiting_memo_approval" && <span className="chip chip-navy !px-1.5 !py-0 !text-[10.5px]">review</span>}
          </button>
        ))}
      </div>

      {view === "workspace" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,420px)]">
          <div className="space-y-4">
            <CaseFileCard runId={id} record={rec} courts={courts} canEdit={canEditCase && awaitingPlan} onSaved={refresh} />
            <PlanEditor runId={id} plan={run.plan} awaiting={awaitingPlan} isAttorney={isAttorney} onApproved={refresh} />
          </div>
          <section className="space-y-3" aria-label="Live agent trace">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-navy">Live agent trace</h2>
              {run.llm_provider && <span className="chip chip-grey" title="Language model provider">{run.llm_provider}</span>}
            </div>
            <div className="card px-4 py-3">
              <div className="mb-1.5 flex justify-between text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden="true" />{approvedMs != null ? `${Math.round(elapsed)} s elapsed · target ${TARGET_S} s` : `Timer starts when the plan is approved (target ${TARGET_S} s)`}</span>
                <span className={elapsed > TARGET_S ? "text-bad" : "text-ok"}>{elapsed > TARGET_S ? "over target" : approvedMs != null ? "within target" : ""}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e6eaf1]" role="progressbar" aria-valuemin={0} aria-valuemax={TARGET_S} aria-valuenow={Math.round(Math.min(elapsed, TARGET_S))} aria-label="Elapsed time against the 90 second target">
                <div className={`h-full rounded-full transition-all ${elapsed > TARGET_S ? "bg-bad" : "bg-gradient-to-r from-amber to-[#f7b955]"}`} style={{ width: `${pct}%` }} />
              </div>
              {loops > 1 && <p className="mt-2 text-xs font-semibold text-amber-dark">↻ Loop: the Research Agent searched {loops} times because coverage was thin.</p>}
            </div>
            <ol className="pt-1" aria-live="polite" aria-label="Agent progress">
              {trace.map((r, i) => <AgentTraceCard key={r.id} row={r} now={now} last={i === trace.length - 1} />)}
            </ol>
            {run.cost_usd > 0 && <p className="text-xs text-muted">LLM cost so far: ${run.cost_usd.toFixed(3)}</p>}
          </section>
          <div className="lg:col-span-2 xl:col-span-1">{sources}</div>
        </div>
      )}

      {view === "memo" && run.memo && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <MemoEditor run={run} memo={run.memo} items={items} isAttorney={isAttorney} onView={openOpinion} onChanged={refresh} />
          <div className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:rounded-xl">{sources}</div>
        </div>
      )}

      {view === "graph" && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <PrecedentGraph runId={id} refreshKey={`${run.status}:${run.authorities.length}`}
            onSelect={(nid, node) => { const s = findSource(items, { authority_key: nid, citation: node.citation }); if (s) scrollToSource(s.key); }} />
          {sources}
        </div>
      )}

      {drawer && <OpinionDrawer opinionId={drawer.opinionId} quote={drawer.quote} onClose={() => setDrawer(null)} />}
    </div>
  );
}
