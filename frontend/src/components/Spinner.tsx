import { AlertTriangle, Loader2 } from "lucide-react";

export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="space-y-3 p-1" role="status" aria-label={text}>
      <p className="flex items-center gap-2 text-muted"><Loader2 size={16} className="spin" aria-hidden="true" />{text}</p>
      <div className="skeleton h-16 w-full" />
      <div className="skeleton h-40 w-full" />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="alert alert-bad flex items-start gap-2" role="alert">
      <AlertTriangle size={16} className="mt-0.5 flex-none" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function PageHeader({ title, sub, icon, actions, eyebrow }: {
  title: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy text-amber shadow-sm">{icon}</span>}
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
          <h1 className="page-title">{title}</h1>
          {sub && <p className="page-sub">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-paper text-navy-3">{icon}</span>
      <h2 className="text-base font-bold text-navy">{title}</h2>
      {children && <div className="mt-1 max-w-lg text-muted">{children}</div>}
    </div>
  );
}
