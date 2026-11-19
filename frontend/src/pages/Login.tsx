import { useState, type FormEvent } from "react";
import { FileCheck2, Gavel, Lock, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useServerStatus } from "../hooks/useServerStatus";
import { LogoMark, Wordmark } from "../components/Logo";
import Footer from "../components/Footer";
import ServerBanner from "../components/ServerBanner";
import { errMsg } from "../util";

const DEMO: { email: string; role: string }[] = [
  { email: "attorney@stare.local", role: "Attorney" },
  { email: "paralegal@stare.local", role: "Paralegal" },
  { email: "admin@stare.local", role: "Admin" },
];

const POINTS = [
  { icon: <ShieldCheck size={18} />, title: "Citation Firewall", text: "Every citation passes four checks against real court records before a lawyer sees it." },
  { icon: <Gavel size={18} />, title: "Ranked like a court", text: "Binding and persuasive authority for the filing court, plus the cases against your client." },
  { icon: <FileCheck2 size={18} />, title: "Attorney in control", text: "Nothing is searched before the plan is approved, and nothing is exported before the memo is." },
];

export default function Login() {
  const { login } = useAuth();
  const { health } = useServerStatus();
  const [email, setEmail] = useState("attorney@stare.local");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try { await login(email.trim(), password); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  }

  const opinions = health?.corpus?.opinions;
  return (
    <div className="flex min-h-screen flex-col bg-navy">
      <ServerBanner />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-amber/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-32 h-[480px] w-[480px] rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <section className="text-white">
            <div className="flex items-center gap-3">
              <LogoMark size={44} />
              <Wordmark className="text-4xl" />
            </div>
            <h1 className="mt-6 max-w-md text-[28px] font-bold leading-tight tracking-tight">Verified federal employment-discrimination research.</h1>
            <p className="mt-3 max-w-md text-slate-300">
              Six AI agents take a complaint to an IRAC research memo{opinions ? `, searching ${opinions.toLocaleString()} real federal opinions` : ""}, and a rule-based firewall stops any citation it cannot verify.
            </p>
            <ul className="mt-7 space-y-4">
              {POINTS.map((p) => (
                <li key={p.title} className="flex gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-white/10 text-amber ring-1 ring-white/10">{p.icon}</span>
                  <span>
                    <span className="block font-semibold">{p.title}</span>
                    <span className="block text-sm text-slate-300">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <form onSubmit={submit} className="card space-y-4 p-7 shadow-2xl" aria-label="Sign in">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-navy"><Lock size={18} aria-hidden="true" />Sign in</h2>
              <p className="text-sm text-muted">Use your firm account.</p>
            </div>
            {err && <div className="alert alert-bad" role="alert">{err}</div>}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pw">Password</label>
              <input id="pw" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-lg w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
            <div className="rounded-xl border border-line bg-paper p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-navy"><Users size={14} aria-hidden="true" />Demo accounts <span className="font-normal text-muted">(password <code>stare-demo</code>)</span></p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                {DEMO.map((d) => (
                  <button type="button" key={d.email} onClick={() => { setEmail(d.email); setPassword("stare-demo"); }}
                    className={`rounded-lg border px-2 py-1.5 text-left text-xs transition-colors hover:border-navy-3 ${email === d.email ? "border-navy-3 bg-white shadow-sm" : "border-line bg-white/60"}`}>
                    <span className="block font-semibold text-navy">{d.role}</span>
                    <span className="block truncate text-muted">{d.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>
      </main>
      <Footer dark />
    </div>
  );
}
