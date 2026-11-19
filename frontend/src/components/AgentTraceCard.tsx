import { FileSearch, Gavel, PenLine, Scale, Search, ShieldCheck } from "lucide-react";
import type { TraceRow } from "../lib/trace";
import { fmtSecs, tsMs } from "../util";

const ICON: Record<string, React.ReactNode> = {
  intake: <FileSearch size={16} />,
  research: <Search size={16} />,
  precedent: <Scale size={16} />,
  opposing_counsel: <Gavel size={16} />,
  citation_firewall: <ShieldCheck size={16} />,
  memo: <PenLine size={16} />,
};
const TONE: Record<string, string> = {
  done: "bg-ok-bg text-ok ring-[#b7e2c4]",
  running: "bg-amber-bg text-amber-dark ring-[#f4d58c]",
  error: "bg-bad-bg text-bad ring-[#f2bbb6]",
  waiting: "bg-[#eef1f5] text-[#8a94a6] ring-[#dde3ec]",
  skipped: "bg-[#eef1f5] text-[#8a94a6] ring-[#dde3ec]",
};

export default function AgentTraceCard({ row, now, last }: { row: TraceRow; now: number; last?: boolean }) {
  let timing = "";
  const started = tsMs(row.started_at);
  if (row.status === "running" && started != null) timing = `running ${Math.max(0, (now - started) / 1000).toFixed(0)} s`;
  else if (row.status === "done" || row.status === "error") timing = `${row.status} ${fmtSecs(row.duration_ms)}`.trim();
  else timing = row.status;
  const tone = TONE[row.status] ?? TONE.waiting;
  return (
    <li className="relative flex gap-3 pb-3">
      {!last && <span aria-hidden="true" className={`absolute left-[17px] top-9 bottom-0 w-0.5 ${row.status === "done" ? "bg-[#b7e2c4]" : "bg-line"}`} />}
      <span className={`relative z-10 grid h-9 w-9 flex-none place-items-center rounded-full ring-1 ${tone} ${row.status === "running" ? "animate-pulse" : ""}`} aria-hidden="true">
        {ICON[row.agent] ?? <Search size={16} />}
      </span>
      <div className={`card min-w-0 flex-1 px-3.5 py-2.5 ${row.status === "error" ? "!border-red-300" : ""} ${row.status === "waiting" ? "opacity-70" : ""}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="font-semibold text-navy">{row.label}</span>
          <span className={`text-xs font-semibold tabular-nums ${row.status === "error" ? "text-bad" : row.status === "running" ? "text-amber-dark" : row.status === "done" ? "text-ok" : "text-muted"}`}>
            {timing}
          </span>
        </div>
        <p className="mt-0.5 break-words text-[13px] text-ink/80">{row.summary || "-"}</p>
        {row.runs > 1 && row.agent !== "citation_firewall" && (
          <span className="chip chip-warn mt-1" title="The Research Agent was sent back to search again because coverage was thin">
            ↻ loop: ran {row.runs} times
          </span>
        )}
      </div>
    </li>
  );
}
