import { Check, Loader2, UserCheck, X } from "lucide-react";
import type { Stage } from "../lib/trace";

/** The run's nine stages in one row: done (green), current (amber), waiting (grey); gold rings are attorney gates. */
export default function PipelineStrip({ stages }: { stages: Stage[] }) {
  return (
    <ol className="flex items-start overflow-x-auto pb-1" aria-label="Run progress">
      {stages.map((s, i) => {
        const circle =
          s.state === "done" ? "bg-ok text-white border-ok"
          : s.state === "current" ? "bg-amber text-navy border-amber"
          : s.state === "error" ? "bg-bad text-white border-bad"
          : "bg-white text-[#9aa5b6] border-[#d3d9e3]";
        return (
          <li key={s.key} className="flex min-w-[88px] flex-1 items-start" aria-current={s.state === "current" ? "step" : undefined}>
            <div className="flex w-full flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : stages[i - 1].state === "done" ? "bg-ok" : "bg-line"}`} />
                <span className={`grid h-7 w-7 flex-none place-items-center rounded-full border-2 text-[11px] font-bold ${circle} ${s.gate ? "ring-2 ring-amber/50 ring-offset-1" : ""}`}>
                  {s.state === "done" ? <Check size={14} strokeWidth={3} aria-hidden="true" />
                    : s.state === "current" ? (s.gate ? <UserCheck size={14} aria-hidden="true" /> : <Loader2 size={14} className="spin" aria-hidden="true" />)
                    : s.state === "error" ? <X size={14} strokeWidth={3} aria-hidden="true" />
                    : i + 1}
                </span>
                <span className={`h-0.5 flex-1 ${i === stages.length - 1 ? "opacity-0" : s.state === "done" ? "bg-ok" : "bg-line"}`} />
              </div>
              <span className={`mt-1.5 px-1 text-[11.5px] leading-tight ${s.state === "current" ? "font-bold text-navy" : s.state === "done" ? "font-medium text-ink" : "text-muted"}`}>
                {s.label}
                {s.gate && <span className="block text-[10px] font-semibold uppercase tracking-wide text-amber-dark">attorney</span>}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
