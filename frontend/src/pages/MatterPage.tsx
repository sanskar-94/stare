import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, EyeOff, FileText, History, Landmark, Loader2, Pencil, Play, UploadCloud } from "lucide-react";
import { api } from "../api/client";
import type { DocumentOut, MatterDetail } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { RunStatusPill } from "../components/StatusBadge";
import { ErrorBox, Loading } from "../components/Spinner";
import { errMsg, fmtDate, splitPlaceholders } from "../util";

function Redacted({ text }: { text: string }) {
  return (
    <div className="legal max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-[#fbfcfe] p-4 !text-[14.5px]" tabIndex={0} aria-label="Redacted document text">
      {splitPlaceholders(text).map((p, i) => (p.ph ? <mark key={i} className="ph">{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </div>
  );
}

function DocCard({ doc, canEdit, onSaved }: { doc: DocumentOut; canEdit: boolean; onSaved: (d: DocumentOut) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(doc.redacted_text);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setBusy(true);
    setErr("");
    try {
      const d = await api.patchDocument(doc.id, text);
      onSaved(d);
      setEditing(false);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <article className="card">
      <div className="card-h flex-wrap">
        <h2 className="min-w-0"><FileText size={16} className="flex-none text-navy-3" aria-hidden="true" /><span className="truncate">{doc.file_name}</span></h2>
        <span className="flex flex-wrap items-center gap-1.5 text-xs font-normal">
          <span className="chip chip-navy">{doc.page_count} page{doc.page_count === 1 ? "" : "s"}</span>
          <span className="chip chip-warn"><EyeOff size={12} aria-hidden="true" />{doc.redaction_count} personal details redacted</span>
          {doc.ocr_used && <span className="chip chip-grey" title="Text was recognised from scanned pages and may contain errors">OCR used</span>}
          <span className="chip chip-grey" title="Redaction engine">{doc.redaction_engine}</span>
        </span>
      </div>
      <div className="card-b space-y-3">
        {editing ? (
          <>
            <label className="label" htmlFor={`ed${doc.id}`}>Edit redactions (keep placeholders such as [PERSON_1])</label>
            <textarea id={`ed${doc.id}`} className="input legal h-72" value={text} onChange={(e) => setText(e.target.value)} />
            {err && <ErrorBox message={err} />}
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save redactions"}</button>
              <button className="btn" onClick={() => { setText(doc.redacted_text); setEditing(false); }}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <Redacted text={doc.redacted_text} />
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && <button className="btn btn-sm" onClick={() => { setText(doc.redacted_text); setEditing(true); }}><Pencil size={13} aria-hidden="true" />Edit redactions</button>}
              <span className="text-xs text-muted">Only this redacted text is stored or sent to a language model.</span>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

export default function MatterPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const { isRole } = useAuth();
  const canEdit = isRole("attorney", "paralegal");
  const [m, setM] = useState<MatterDetail | null>(null);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [starting, setStarting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => api.matter(id).then(setM).catch((e) => setErr(errMsg(e))), [id]);
  useEffect(() => { load(); }, [load]);

  async function upload(files: FileList | File[]) {
    setErr("");
    for (const f of Array.from(files)) {
      if (!/\.(pdf|txt|docx)$/i.test(f.name)) { setErr(`${f.name}: only PDF, TXT and DOCX files are supported.`); continue; }
      setUploading((u) => [...u, f.name]);
      try { await api.uploadDocument(id, f); await load(); } catch (e) { setErr(`${f.name}: ${errMsg(e)}`); }
      setUploading((u) => u.filter((n) => n !== f.name));
    }
  }

  async function start() {
    setStarting(true);
    setErr("");
    try { const r = await api.startRun(id); nav(`/runs/${r.id}`); } catch (e) { setErr(errMsg(e)); setStarting(false); }
  }

  if (!m) return err ? <ErrorBox message={err} /> : <Loading text="Loading matter..." />;
  const runs = [...m.runs].sort((a, b) => b.id - a.id);
  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-navy"><ChevronLeft size={15} aria-hidden="true" />All matters</Link>
      <section className="card card-b flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow font-mono">{m.matter_number}</div>
          <h1 className="page-title">{m.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5"><Landmark size={14} aria-hidden="true" />{m.court_name ?? "Court not set (read from the complaint)"}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />Created {fmtDate(m.created_at)}</span>
            <span className="inline-flex items-center gap-1.5"><FileText size={14} aria-hidden="true" />{m.documents.length} document{m.documents.length === 1 ? "" : "s"}</span>
          </p>
          {m.notes && <p className="mt-2 max-w-3xl">{m.notes}</p>}
        </div>
        {canEdit && (
          <div className="text-right">
            <button className="btn btn-amber btn-lg" onClick={start} disabled={starting || m.documents.length === 0}
              title={m.documents.length === 0 ? "Upload at least one document first" : "Read the documents, then propose a research plan"}>
              {starting ? <Loader2 size={17} className="spin" aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
              {starting ? "Starting..." : "Start research run"}
            </button>
            <p className="mt-1 text-xs text-muted">{m.documents.length === 0 ? "Upload a document first" : "Reads the documents, then proposes a plan for approval"}</p>
          </div>
        )}
      </section>
      {err && <ErrorBox message={err} />}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4" aria-label="Documents">
          <h2 className="flex items-center gap-2 text-base font-bold text-navy"><FileText size={17} aria-hidden="true" />Documents</h2>
          {canEdit && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
              className={`rounded-2xl border-2 border-dashed px-6 py-7 text-center transition-colors ${drag ? "border-amber bg-amber-bg" : "border-[#c9d2df] bg-white hover:border-navy-3/50"}`}
            >
              <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full bg-paper text-navy-3"><UploadCloud size={22} aria-hidden="true" /></span>
              <p className="font-semibold text-navy">Drag and drop a complaint, EEOC charge or termination letter</p>
              <p className="text-xs text-muted">PDF (scanned pages are read with OCR), TXT or DOCX. Personal details are redacted before anything is stored.</p>
              <button className="btn mt-3" onClick={() => fileRef.current?.click()}>Choose files</button>
              <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.docx" className="sr-only" aria-label="Upload documents"
                onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ""; }} />
              {uploading.map((n) => <p key={n} className="mt-2 flex items-center justify-center gap-2 text-sm text-amber-dark" role="status"><Loader2 size={14} className="spin" aria-hidden="true" />Reading and redacting {n}...</p>)}
            </div>
          )}
          {m.documents.length === 0 && <p className="text-muted">No documents yet.</p>}
          {m.documents.map((d) => (
            <DocCard key={d.id} doc={d} canEdit={canEdit} onSaved={(nd) => setM((x) => x && { ...x, documents: x.documents.map((o) => (o.id === nd.id ? nd : o)) })} />
          ))}
        </section>

        <aside aria-label="Research runs" className="space-y-3 lg:sticky lg:top-20">
          <h2 className="flex items-center gap-2 text-base font-bold text-navy"><History size={17} aria-hidden="true" />Research runs</h2>
          <div className="card overflow-hidden">
            {runs.length === 0 ? <p className="card-b text-muted">No runs yet. Upload a document, then start a run.</p> : (
              <ul>
                {runs.map((r, i) => (
                  <li key={r.id} className="border-b border-line last:border-0">
                    <Link to={`/runs/${r.id}`} className="flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-[#f8fafd]">
                      <span>
                        <span className="font-semibold text-navy">Run {runs.length - i}</span>
                        <span className="block text-xs text-muted">{fmtDate(r.created_at)} · {r.llm_provider}</span>
                      </span>
                      <span className="flex items-center gap-1.5"><RunStatusPill status={r.status} /><ChevronRight size={15} className="text-muted" aria-hidden="true" /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
