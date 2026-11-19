import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { Health } from "../api/types";

interface ServerStatus {
  online: boolean | null; // null until the first check
  health: Health | null;
  checking: boolean;
  recheck: () => void;
}

const Ctx = createContext<ServerStatus>({ online: null, health: null, checking: false, recheck: () => {} });

/** Polls /api/health: every 20 s while online, every 4 s while the server is down or still warming up. */
export function ServerStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const check = useCallback(async () => {
    clearTimeout(timer.current);
    setChecking(true);
    let ok = false;
    let warming = false;
    try {
      const h = await api.health();
      setHealth(h);
      ok = true;
      warming = h.search_ready === false;
    } catch {
      ok = false;
    }
    setOnline(ok);
    setChecking(false);
    timer.current = setTimeout(check, ok && !warming ? 20_000 : 4_000);
  }, []);

  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(timer.current); window.removeEventListener("focus", onFocus); };
  }, [check]);

  return <Ctx.Provider value={{ online, health, checking, recheck: check }}>{children}</Ctx.Provider>;
}

export const useServerStatus = () => useContext(Ctx);
