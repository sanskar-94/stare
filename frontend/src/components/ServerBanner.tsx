import { RefreshCw, ServerCrash, Timer } from "lucide-react";
import { useServerStatus } from "../hooks/useServerStatus";

/** A clear message when the API is down (instead of pages that never finish loading). */
export default function ServerBanner() {
  const { online, health, checking, recheck } = useServerStatus();
  if (online === false) {
    return (
      <div className="border-b border-red-200 bg-red-50 text-red-900" role="alert">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-[13px]">
          <ServerCrash size={18} className="flex-none text-red-600" aria-hidden="true" />
          <span className="font-semibold">The STARE server is not running.</span>
          <span>Start it with <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[12px]">cd backend && .venv/bin/stare serve</code>; this page reconnects by itself.</span>
          <button className="btn btn-sm ml-auto" onClick={recheck} disabled={checking}>
            <RefreshCw size={13} className={checking ? "spin" : ""} aria-hidden="true" />Retry now
          </button>
        </div>
      </div>
    );
  }
  if (online && health?.search_ready === false) {
    return (
      <div className="border-b border-amber/40 bg-amber-bg text-amber-dark" role="status">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-5 py-2 text-[13px]">
          <Timer size={16} aria-hidden="true" />
          The server is loading the search index and embedding model (about 15 seconds after start-up). You can sign in and upload meanwhile.
        </div>
      </div>
    );
  }
  return null;
}
