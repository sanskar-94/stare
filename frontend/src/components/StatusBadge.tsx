import { CheckCircle2, CircleHelp, OctagonX, TriangleAlert } from "lucide-react";
import type { CheckStatus, RunStatus } from "../api/types";

export const CHECK_LABEL: Record<CheckStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  verified: { label: "VERIFIED", cls: "chip-ok", icon: <CheckCircle2 size={12} aria-hidden="true" /> },
  warning: { label: "WARNING", cls: "chip-warn", icon: <TriangleAlert size={12} aria-hidden="true" /> },
  blocked: { label: "BLOCKED", cls: "chip-bad", icon: <OctagonX size={12} aria-hidden="true" /> },
  unresolved: { label: "UNRESOLVED", cls: "chip-grey", icon: <CircleHelp size={12} aria-hidden="true" /> },
};

export function CheckBadge({ status }: { status: CheckStatus }) {
  const c = CHECK_LABEL[status] ?? CHECK_LABEL.unresolved;
  return <span className={`chip ${c.cls}`}>{c.icon}{c.label}</span>;
}

export function runStatusInfo(status: RunStatus | string, runNo?: number): { label: string; cls: string; busy: boolean } {
  const n = runNo ? `Run ${runNo}: ` : "";
  switch (status) {
    case "intake_running": return { label: `${n}reading documents`, cls: "chip-warn", busy: true };
    case "researching": return { label: `${n}researching`, cls: "chip-warn", busy: true };
    case "awaiting_plan_approval": return { label: "Plan awaits approval", cls: "chip-navy", busy: false };
    case "awaiting_memo_approval": return { label: "Memo awaits approval", cls: "chip-navy", busy: false };
    case "approved": return { label: "Approved", cls: "chip-ok", busy: false };
    case "exported": return { label: "Exported", cls: "chip-ok", busy: false };
    case "failed": return { label: "Failed", cls: "chip-bad", busy: false };
    case "cancelled": return { label: "Cancelled", cls: "chip-grey", busy: false };
    default: return { label: String(status).replace(/_/g, " "), cls: "chip-grey", busy: false };
  }
}

export function RunStatusPill({ status, runNo, large = false }: { status: RunStatus | string; runNo?: number; large?: boolean }) {
  const i = runStatusInfo(status, runNo);
  return (
    <span className={`chip ${i.cls} ${large ? "!px-3 !py-1 !text-[13px]" : ""}`}>
      {i.busy && <span className="dot dot-running !h-2 !w-2" aria-hidden="true" />}
      {!i.busy && (status === "exported" || status === "approved") && <CheckCircle2 size={12} aria-hidden="true" />}
      {i.label}
    </span>
  );
}
