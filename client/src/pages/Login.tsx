import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await login(email, password);
    if (!ok) {
      toast({ title: "Login failed", description: "Invalid email/username or password", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(222, 20%, 7%)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-4">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-label="Gradum">
              <circle cx="24" cy="24" r="22" stroke="var(--color-cyan)" strokeWidth="2" />
              <path d="M14 24 L24 10 L34 24 L24 34 Z" fill="var(--color-cyan)" opacity="0.85" />
              <circle cx="24" cy="24" r="4" fill="hsl(222, 20%, 7%)" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "hsl(210, 15%, 88%)" }}>
            Gradum Command Center
          </h1>
          <p className="text-sm mt-1" style={{ color: "hsl(210, 10%, 52%)" }}>
            Athlete Lead Generation System
          </p>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs" style={{ color: "hsl(210, 10%, 52%)" }}>
          <span className="operational-dot w-2 h-2 rounded-full" style={{ background: "var(--color-green)" }} />
          ALL SYSTEMS ONLINE
        </div>

        {/* Login form */}
        <div className="rounded-xl p-6" style={{ background: "hsl(222, 18%, 10%)", border: "1px solid hsl(222, 15%, 18%)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "hsl(210, 10%, 52%)" }}>
                Email or Username
              </label>
              <input
                data-testid="input-email"
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  background: "hsl(222, 15%, 14%)",
                  border: "1px solid hsl(222, 15%, 18%)",
                  color: "hsl(210, 15%, 88%)",
                  outline: "none",
                }}
                placeholder="you@gradumgswing.com or username"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "hsl(210, 10%, 52%)" }}>
                Password
              </label>
              <input
                data-testid="input-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  background: "hsl(222, 15%, 14%)",
                  border: "1px solid hsl(222, 15%, 18%)",
                  color: "hsl(210, 15%, 88%)",
                  outline: "none",
                }}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              data-testid="button-login"
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: loading ? "hsl(222, 15%, 18%)" : "var(--color-cyan)",
                color: "hsl(222, 20%, 7%)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs mt-4" style={{ color: "hsl(210, 10%, 35%)" }}>
          Gradum Gswing · Athlete Lead Gen v2.0
        </p>
      </div>
    </div>
  );
}
