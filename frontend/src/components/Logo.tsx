export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#14305a" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#ffffff" strokeOpacity="0.12" />
      <path d="M9 21c2 2 12 2 12-2s-12-2-12-6 9-4 13-2" fill="none" stroke="#f5a623" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-extrabold tracking-[0.2em] ${className}`}>ST<span className="text-amber">A</span>RE</span>;
}
