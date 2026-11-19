export default function Footer({ dark = false }: { dark?: boolean }) {
  return (
    <footer className={`px-4 py-3 text-center text-xs ${dark ? "bg-navy text-slate-400" : "border-t border-line bg-white/70 text-muted"}`}>
      Research assistant for licensed attorneys. Output is not legal advice; every memo needs attorney review.
    </footer>
  );
}
