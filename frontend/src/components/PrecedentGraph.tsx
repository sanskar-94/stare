import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Network, ZoomIn, ZoomOut } from "lucide-react";
import { api } from "../api/client";
import type { GraphEdge, GraphNode, GraphOut } from "../api/types";
import { errMsg } from "../util";

const W = 1000;
const H = 620;
const FILL: Record<string, string> = { verified: "#16a34a", warning: "#f5a623", blocked: "#dc2626", unresolved: "#9aa5b6" };
const LABEL: Record<string, string> = { verified: "Verified", warning: "Warning", blocked: "Blocked", unresolved: "Unresolved" };
const MAX_LABEL = 26;

interface P { x: number; y: number; vx: number; vy: number; hw: number }

const short = (s: string) => (s.length > MAX_LABEL ? s.slice(0, MAX_LABEL - 1) + "…" : s);

/**
 * Deterministic force layout (repulsion, spring edges, gravity), then a pass that pushes apart nodes whose
 * name labels would overlap, so every case name stays readable.
 */
function layout(nodes: GraphNode[], edges: GraphEdge[]): Map<string, P> {
  const pos = new Map<string, P>();
  const n = Math.max(1, nodes.length);
  nodes.forEach((nd, i) => {
    const a = (2 * Math.PI * i) / n;
    const hw = Math.max(26, short(nd.label).length * 3.1 + 8); // half the label width at 11 px
    pos.set(nd.id, { x: W / 2 + Math.cos(a) * 260, y: H / 2 + Math.sin(a) * 190, vx: 0, vy: 0, hw });
  });
  const ids = nodes.map((nd) => nd.id);
  const IT = 360;
  for (let it = 0; it < IT; it++) {
    const cool = 1 - it / IT;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i])!, b = pos.get(ids[j])!;
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = ((i * 7) % 5) - 2 || 1; dy = ((j * 3) % 5) - 2 || 1; d2 = dx * dx + dy * dy; }
        const d = Math.sqrt(d2);
        const f = 9000 / d2;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = pos.get(e.source), b = pos.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 170) * 0.025;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const id of ids) {
      const p = pos.get(id)!;
      p.vx += (W / 2 - p.x) * 0.01; p.vy += (H / 2 - p.y) * 0.016;
      p.x += Math.max(-30, Math.min(30, p.vx)) * cool; p.y += Math.max(-30, Math.min(30, p.vy)) * cool;
      p.vx *= 0.6; p.vy *= 0.6;
    }
  }
  // label boxes: node shape (r 16) plus the name 30 px below it
  for (let pass = 0; pass < 140; pass++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i])!, b = pos.get(ids[j])!;
        const ox = a.hw + b.hw + 6 - Math.abs(a.x - b.x);
        const oy = 52 - Math.abs(a.y - b.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox < oy * 1.4) { const s = (a.x < b.x ? -1 : 1) * (ox / 2 + 0.5); a.x += s; b.x -= s; }
          else { const s = (a.y < b.y ? -1 : 1) * (oy / 2 + 0.5); a.y += s; b.y -= s; }
        }
      }
    }
    if (!moved) break;
  }
  return pos;
}

function Shape({ n, cx, cy, active }: { n: GraphNode; cx: number; cy: number; active: boolean }) {
  const fill = FILL[n.check_status ?? "unresolved"] ?? FILL.unresolved;
  const common = { fill, stroke: "#0b1f3a", strokeWidth: n.status === "binding" ? 4 : 2, strokeDasharray: n.status === "persuasive" ? "4 3" : undefined } as const;
  const r = 15;
  if (n.adverse) return <polygon points={`${cx},${cy - r - 4} ${cx + r + 4},${cy} ${cx},${cy + r + 4} ${cx - r - 4},${cy}`} {...common} stroke={active ? "#f5a623" : "#b42318"} strokeWidth={active ? 4 : 3} />;
  if (n.status === "flagged") return <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} rx={4} {...common} />;
  return <circle cx={cx} cy={cy} r={r} {...common} stroke={active ? "#f5a623" : "#0b1f3a"} />;
}

type Box = { x: number; y: number; w: number; h: number };

export default function PrecedentGraph({ runId, refreshKey, onSelect }: { runId: number; refreshKey: string; onSelect: (id: string, node: GraphNode) => void }) {
  const [g, setG] = useState<GraphOut | null>(null);
  const [err, setErr] = useState("");
  const [hover, setHover] = useState<GraphNode | null>(null);
  const [vb, setVb] = useState<Box | null>(null);
  const drag = useRef<{ x: number; y: number; vb: Box } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { api.graph(runId).then((x) => { setG(x); setErr(""); }).catch((e) => setErr(errMsg(e))); }, [runId, refreshKey]);
  useEffect(() => {
    // zooming with the wheel must not also scroll the page (React's wheel handler is passive)
    const el = svgRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, [g]);
  const pos = useMemo(() => (g ? layout(g.nodes, g.edges) : new Map<string, P>()), [g]);
  const fit = useMemo<Box>(() => {
    if (!pos.size) return { x: 0, y: 0, w: W, h: H };
    const ps = [...pos.values()];
    const x0 = Math.min(...ps.map((p) => p.x - p.hw)) - 20, x1 = Math.max(...ps.map((p) => p.x + p.hw)) + 20;
    const y0 = Math.min(...ps.map((p) => p.y)) - 34, y1 = Math.max(...ps.map((p) => p.y)) + 50;
    const w = Math.max(x1 - x0, 400), h = Math.max(y1 - y0, 260);
    const scale = Math.max(w / W, h / H);
    const cw = W * scale, ch = H * scale;
    return { x: (x0 + x1) / 2 - cw / 2, y: (y0 + y1) / 2 - ch / 2, w: cw, h: ch };
  }, [pos]);
  useEffect(() => { setVb(null); }, [fit]);
  const box = vb ?? fit;

  const neighbours = useMemo(() => {
    if (!hover || !g) return null;
    const s = new Set<string>([hover.id]);
    g.edges.forEach((e) => { if (e.source === hover.id) s.add(e.target); if (e.target === hover.id) s.add(e.source); });
    return s;
  }, [hover, g]);

  function zoom(f: number, cx = box.x + box.w / 2, cy = box.y + box.h / 2) {
    const w = Math.min(fit.w * 2, Math.max(fit.w / 4, box.w * f)), h = (w / box.w) * box.h;
    setVb({ x: cx - ((cx - box.x) / box.w) * w, y: cy - ((cy - box.y) / box.h) * h, w, h });
  }
  function toSvg(e: { clientX: number; clientY: number }) {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: box.x + ((e.clientX - r.left) / r.width) * box.w, y: box.y + ((e.clientY - r.top) / r.height) * box.h };
  }

  if (err) return <div className="alert alert-bad" role="alert">{err}</div>;
  if (!g) return <p className="text-muted" role="status">Loading graph...</p>;
  if (g.nodes.length === 0) return <div className="card card-b text-muted">The precedent graph appears once the Precedent Agent has mapped how the retrieved cases cite each other.</div>;
  const hp = hover ? pos.get(hover.id) : null;
  const showAllTreatments = g.edges.length <= 14;

  return (
    <section className="card min-w-0" aria-label="Precedent graph">
      <div className="card-h flex-wrap">
        <h2><Network size={16} aria-hidden="true" />Precedent graph <span className="text-xs font-normal text-muted">{g.nodes.length} authorities · {g.edges.length} citation links</span></h2>
        <div className="flex items-center gap-1">
          <button className="btn btn-sm" onClick={() => zoom(0.8)} aria-label="Zoom in"><ZoomIn size={14} /></button>
          <button className="btn btn-sm" onClick={() => zoom(1.25)} aria-label="Zoom out"><ZoomOut size={14} /></button>
          <button className="btn btn-sm" onClick={() => setVb(null)} aria-label="Fit to view"><Maximize2 size={14} />Fit</button>
        </div>
      </div>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2 text-xs text-muted" aria-label="Legend">
        {Object.entries(LABEL).map(([k, v]) => <li key={k} className="flex items-center gap-1"><span className="dot" style={{ background: FILL[k] }} />{v}</li>)}
        <li><b className="text-navy">Thick ring</b> binding</li>
        <li><b className="text-navy">Dashed ring</b> persuasive</li>
        <li><b className="text-navy">◆ Diamond</b> adverse</li>
        <li><b className="text-navy">■ Square</b> flagged</li>
        <li className="ml-auto">Arrow: cites · scroll to zoom, drag to move</li>
      </ul>
      <div className="relative overflow-hidden bg-[radial-gradient(#e3e8f0_1px,transparent_1px)] [background-size:18px_18px]">
        <svg ref={svgRef} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="h-[560px] w-full cursor-grab active:cursor-grabbing"
          role="group" aria-label="Directed graph of how cited cases treat each other"
          onWheel={(e) => { const p = toSvg(e); zoom(e.deltaY > 0 ? 1.12 : 0.89, p.x, p.y); }}
          onMouseDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vb: box }; }}
          onMouseMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const r = svgRef.current!.getBoundingClientRect();
            setVb({ ...d.vb, x: d.vb.x - ((e.clientX - d.x) / r.width) * d.vb.w, y: d.vb.y - ((e.clientY - d.y) / r.height) * d.vb.h });
          }}
          onMouseUp={() => { drag.current = null; }} onMouseLeave={() => { drag.current = null; }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#7a869a" /></marker>
            <marker id="arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#24477d" /></marker>
          </defs>
          {g.edges.map((e, i) => {
            const a = pos.get(e.source), b = pos.get(e.target);
            if (!a || !b) return null;
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            const x2 = b.x - (dx / d) * 22, y2 = b.y - (dy / d) * 22;
            const hi = !!hover && (e.source === hover.id || e.target === hover.id);
            const dim = !!hover && !hi;
            return (
              <g key={i} opacity={dim ? 0.15 : 1}>
                <line x1={a.x} y1={a.y} x2={x2} y2={y2} stroke={hi ? "#24477d" : "#9aa5b6"} strokeWidth={hi ? 2.2 : 1.4} markerEnd={`url(#${hi ? "arrow-hi" : "arrow"})`} />
                {e.treatment && (showAllTreatments || hi) && (
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" fontSize="10.5" fill="#33405a" stroke="#fff" strokeWidth="3" paintOrder="stroke">{e.treatment}</text>
                )}
              </g>
            );
          })}
          {g.nodes.map((n) => {
            const p = pos.get(n.id)!;
            const dim = !!neighbours && !neighbours.has(n.id);
            return (
              <g key={n.id} tabIndex={0} role="button" opacity={dim ? 0.25 : 1}
                aria-label={`${n.label}, ${n.citation}, ${LABEL[n.check_status ?? "unresolved"]}${n.adverse ? ", adverse" : ""}${n.status ? `, ${n.status}` : ""}`}
                className="cursor-pointer outline-none focus-visible:[&>*:first-child]:stroke-[#f5a623]"
                onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n)} onBlur={() => setHover(null)}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onSelect(n.id, n)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n.id, n); } }}>
                <Shape n={n} cx={p.x} cy={p.y} active={hover?.id === n.id} />
                <text x={p.x} y={p.y + 33} textAnchor="middle" fontSize="11" fontStyle="italic" fontWeight={hover?.id === n.id ? 700 : 500} fill="#172033" stroke="#fff" strokeWidth="3.5" paintOrder="stroke">
                  {short(n.label)}
                </text>
              </g>
            );
          })}
        </svg>
        {hover && hp && (
          <div className="pointer-events-none absolute z-10 max-w-xs rounded-lg bg-navy px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `${((hp.x - box.x) / box.w) * 100}%`, top: `${((hp.y - box.y) / box.h) * 100}%`, transform: "translate(-50%, -130%)" }} role="tooltip">
            <p className="font-semibold italic">{hover.label}</p>
            <p>{hover.citation}</p>
            <p className="text-slate-300">{[hover.court, hover.year].filter(Boolean).join(", ")}</p>
            <p>{LABEL[hover.check_status ?? "unresolved"]}{hover.status ? ` · ${hover.status}` : ""}{hover.adverse ? " · adverse" : ""}</p>
            <p className="text-amber">Click to jump to its source card</p>
          </div>
        )}
      </div>
    </section>
  );
}
