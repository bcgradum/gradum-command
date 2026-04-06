import { Link } from "wouter";
export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full flex-col gap-4" style={{ background: "hsl(222, 20%, 7%)" }}>
      <div className="text-4xl font-bold tabular" style={{ color: "hsl(210, 15%, 30%)" }}>404</div>
      <div className="text-sm" style={{ color: "hsl(210, 10%, 45%)" }}>Page not found</div>
      <Link href="/"><a className="text-sm" style={{ color: "var(--color-cyan)" }}>Return to Command Center</a></Link>
    </div>
  );
}
