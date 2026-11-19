import { NavLink } from "react-router-dom";
import { Briefcase, LogOut, ScrollText, Settings, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useServerStatus } from "../hooks/useServerStatus";
import { initials } from "../util";
import { LogoMark, Wordmark } from "./Logo";

const link = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors ${
    isActive ? "bg-white/15 text-white shadow-[inset_0_-2px_0_#f5a623]" : "text-slate-300 hover:bg-white/10 hover:text-white"
  }`;

function ServerPill() {
  const { online, health } = useServerStatus();
  if (online === null) return null;
  const warming = online && health?.search_ready === false;
  const cls = !online ? "bg-red-500/15 text-red-200 ring-red-400/30" : warming ? "bg-amber/15 text-amber ring-amber/30" : "bg-emerald-400/10 text-emerald-200 ring-emerald-300/25";
  const dot = !online ? "bg-red-400" : warming ? "bg-amber" : "bg-emerald-400";
  const text = !online ? "Server offline" : warming ? "Loading search..." : `Online · ${(health?.corpus?.opinions ?? 0).toLocaleString()} opinions`;
  return (
    <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 md:inline-flex ${cls}`} role="status"
      title={online ? `API v${health?.version ?? ""} · language model: ${health?.llm_provider ?? ""}` : "The STARE API is not answering"}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${warming ? "animate-pulse" : ""}`} />
      {text}
    </span>
  );
}

export default function Header() {
  const { user, logout, isRole } = useAuth();
  const admin = isRole("admin");
  return (
    <header className="sticky top-0 z-40 bg-navy text-white shadow-[0_1px_0_rgba(255,255,255,0.06),0_4px_16px_-8px_rgba(11,31,58,0.6)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-amber focus:px-3 focus:py-1 focus:text-navy">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
        <NavLink to="/" className="flex items-center gap-2.5" aria-label="STARE home">
          <LogoMark />
          <span className="leading-none">
            <Wordmark className="block text-[17px]" />
            <span className="mt-0.5 hidden text-[10.5px] font-medium tracking-wide text-slate-400 lg:block">Verified employment-law research</span>
          </span>
        </NavLink>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <NavLink to="/" end className={link}><Briefcase size={15} aria-hidden="true" />Matters</NavLink>
          <NavLink to="/firewall" className={link}><ShieldCheck size={15} aria-hidden="true" />Check a draft</NavLink>
          {admin && <NavLink to="/audit" className={link}><ScrollText size={15} aria-hidden="true" />Audit log</NavLink>}
          {admin && <NavLink to="/users" className={link}><Users size={15} aria-hidden="true" />Users</NavLink>}
          {admin && <NavLink to="/settings" className={link}><Settings size={15} aria-hidden="true" />Settings</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <ServerPill />
          <span className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-amber text-xs font-bold text-navy" aria-hidden="true">{initials(user?.name)}</span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[13px] font-semibold text-white">{user?.name}</span>
              <span className="block text-[11px] capitalize text-slate-400">{user?.role}</span>
            </span>
          </span>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-[13px] text-slate-200 hover:bg-white/10 hover:text-white" onClick={logout}>
            <LogOut size={14} aria-hidden="true" />Log out
          </button>
        </div>
      </div>
    </header>
  );
}
