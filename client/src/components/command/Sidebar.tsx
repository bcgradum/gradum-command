import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Facility } from "@shared/schema";

const STATE_FLAGS: Record<string, string> = {
  FL: "🌴", TX: "⭐", NC: "🌲", SC: "🌊", GA: "🍑", OK: "🌾", UT: "🏔"
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });

  const active = facilities.filter(f => f.status === "active");
  const parked = facilities.filter(f => f.status === "parked");
  const states = [...new Set(active.map(f => f.state))].sort();

  return (
    <div className="flex flex-col h-full" style={{ background: "hsl(222, 20%, 8%)", borderRight: "1px solid hsl(222, 15%, 14%)", width: 220 }}>
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid hsl(222, 15%, 14%)" }}>
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="var(--color-cyan)" strokeWidth="2" />
          <path d="M14 24 L24 10 L34 24 L24 34 Z" fill="var(--color-cyan)" opacity="0.85" />
          <circle cx="24" cy="24" r="4" fill="hsl(222, 20%, 8%)" />
        </svg>
        <div>
          <div className="text-sm font-bold tracking-tight" style={{ color: "hsl(210, 15%, 88%)" }}>Gradum</div>
          <div className="text-xs" style={{ color: "hsl(210, 10%, 45%)" }}>Command Center</div>
        </div>
      </div>

      {/* Status */}
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="operational-dot w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-green)" }} />
        <span className="text-xs" style={{ color: "hsl(210, 10%, 45%)" }}>
          {active.length} active · {parked.length} parked
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <Link href="/">
          <a className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-1 transition-colors ${location === "/" ? "text-cyan-400" : "text-gray-400 hover:text-gray-200"}`}
            style={{ background: location === "/" ? "var(--color-cyan-dim)" : "transparent" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            Overview
          </a>
        </Link>

        <Link href="/sales">
          <a className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-1 transition-colors ${location === "/sales" ? "text-cyan-400" : "text-gray-400 hover:text-gray-200"}`}
            style={{ background: location === "/sales" ? "var(--color-cyan-dim)" : "transparent" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Sales Tracker
          </a>
        </Link>

        {/* Facilities by state */}
        {states.map(state => {
          const stateFacilities = active.filter(f => f.state === state);
          return (
            <div key={state} className="mb-2">
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(210, 10%, 38%)" }}>
                {STATE_FLAGS[state]} {state}
              </div>
              {stateFacilities.map(f => {
                const href = `/facility/${f.id}`;
                const isActive = location === href;
                return (
                  <Link key={f.id} href={href}>
                    <a className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${isActive ? "text-cyan-400" : "text-gray-400 hover:text-gray-200"}`}
                      style={{ background: isActive ? "var(--color-cyan-dim)" : "transparent" }}
                      data-testid={`link-facility-${f.id}`}>
                      <span className="truncate">{f.locationName.replace("Gradum ", "")}</span>
                      {f.igAccount && (
                        <span className="text-xs shrink-0 ml-1" style={{ color: "hsl(210, 10%, 30%)" }}>●</span>
                      )}
                    </a>
                  </Link>
                );
              })}
            </div>
          );
        })}

        {parked.length > 0 && (
          <div className="mb-2">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(210, 10%, 28%)" }}>
              Parked
            </div>
            {parked.map(f => (
              <div key={f.id} className="flex items-center px-3 py-1.5 rounded-lg text-xs" style={{ color: "hsl(210, 10%, 35%)" }}>
                <span className="truncate">{f.locationName.replace("Gradum ", "")}</span>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid hsl(222, 15%, 14%)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium" style={{ color: "hsl(210, 15%, 75%)" }}>{user?.name}</div>
            <div className="text-xs" style={{ color: "hsl(210, 10%, 40%)" }}>{user?.role}</div>
          </div>
          <button onClick={logout} className="text-xs px-2 py-1 rounded" style={{ color: "hsl(210, 10%, 40%)", background: "hsl(222, 15%, 14%)" }}>
            Out
          </button>
        </div>
      </div>
    </div>
  );
}
