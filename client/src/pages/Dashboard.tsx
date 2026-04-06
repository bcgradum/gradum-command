import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/command/Sidebar";
import type { Facility, ActivityLog } from "@shared/schema";

interface DashboardStats {
  totalAthletes: number;
  totalMatched: number;
  matchRate: number;
  totalSchools: number;
  byState: { state: string; count: number }[];
  recentActivity: ActivityLog[];
}

interface FacilityStats {
  totalAthletes: number;
  matched: number;
  matchRate: number;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "hsl(222, 18%, 10%)", border: "1px solid hsl(222, 15%, 18%)" }}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "hsl(210, 10%, 45%)" }}>{label}</div>
      <div className="text-2xl font-bold stat-number" style={{ color: color || "hsl(210, 15%, 88%)" }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "hsl(210, 10%, 45%)" }}>{sub}</div>}
    </div>
  );
}

function ActivityItem({ item }: { item: ActivityLog }) {
  const typeColors: Record<string, string> = {
    school_scan: "var(--color-purple)",
    roster_pull: "#3498db",
    ig_match: "var(--color-cyan)",
    system: "var(--color-green)",
    error: "var(--color-red)",
  };
  const typeLabels: Record<string, string> = {
    school_scan: "SCN",
    roster_pull: "RST",
    ig_match: "IG",
    system: "SYS",
    error: "ERR",
  };
  const color = typeColors[item.type] || "hsl(210, 10%, 45%)";
  const label = typeLabels[item.type] || "LOG";
  const time = new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="flex items-start gap-3 py-1.5 terminal-log">
      <span className="text-xs shrink-0 w-10" style={{ color: "hsl(210, 10%, 35%)" }}>{time}</span>
      <span className="text-xs px-1.5 py-0.5 rounded font-bold shrink-0 w-10 text-center" style={{ background: `${color}20`, color }}>
        {label}
      </span>
      <span className="text-xs" style={{ color: "hsl(210, 15%, 75%)" }}>
        {item.message}
        {item.count !== null && item.count !== undefined && (
          <span className="ml-2 tabular" style={{ color }}>{item.count.toLocaleString()}</span>
        )}
      </span>
    </div>
  );
}

function FacilityCard({ facility }: { facility: Facility }) {
  const { data: stats } = useQuery<FacilityStats>({
    queryKey: ["/api/facilities", facility.id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facility.id}/stats`);
      return res.json();
    },
  });

  const matchRate = stats?.matchRate ?? 0;
  const total = stats?.totalAthletes ?? 0;
  const matched = stats?.matched ?? 0;

  const stateColors: Record<string, string> = {
    FL: "#3498db", TX: "#f5a623", NC: "#4caf7d", SC: "#9b59b6",
    GA: "#e74c3c", OK: "#e67e22", UT: "#1abc9c",
  };
  const stateColor = stateColors[facility.state] || "var(--color-cyan)";

  if (facility.status === "parked") return null;

  return (
    <Link href={`/facility/${facility.id}`}>
      <a data-testid={`card-facility-${facility.id}`} className="block rounded-xl p-4 transition-all hover:border-cyan-500/40 cursor-pointer"
        style={{ background: "hsl(222, 18%, 10%)", border: "1px solid hsl(222, 15%, 18%)" }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: `${stateColor}20`, color: stateColor }}>
                {facility.state}
              </span>
              <span className="text-sm font-semibold" style={{ color: "hsl(210, 15%, 88%)" }}>
                {facility.locationName.replace("Gradum ", "")}
              </span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(210, 10%, 42%)" }}>
              {facility.igAccount || "No IG account"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="operational-dot w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-green)" }} />
            <span className="text-xs" style={{ color: "var(--color-green)" }}>ACTIVE</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <div className="text-xs" style={{ color: "hsl(210, 10%, 40%)" }}>Athletes</div>
            <div className="text-lg font-bold tabular" style={{ color: "hsl(210, 15%, 88%)" }}>
              {total.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: "hsl(210, 10%, 40%)" }}>Matched</div>
            <div className="text-lg font-bold tabular" style={{ color: "var(--color-cyan)" }}>
              {matched.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: "hsl(210, 10%, 40%)" }}>Match Rate</div>
            <div className="text-lg font-bold tabular" style={{ color: matchRate >= 80 ? "var(--color-green)" : matchRate >= 60 ? "var(--color-amber)" : "var(--color-red)" }}>
              {matchRate}%
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full" style={{ background: "hsl(222, 15%, 18%)" }}>
          <div className="h-full rounded-full transition-all" style={{
            width: `${matchRate}%`,
            background: matchRate >= 80 ? "var(--color-green)" : matchRate >= 60 ? "var(--color-amber)" : "var(--color-red)"
          }} />
        </div>
      </a>
    </Link>
  );
}

function StateBar({ state, count, max }: { state: string; count: number; max: number }) {
  const colors: Record<string, string> = { FL: "#3498db", TX: "#f5a623", NC: "#4caf7d", SC: "#9b59b6", GA: "#e74c3c", OK: "#e67e22", UT: "#1abc9c" };
  const color = colors[state] || "var(--color-cyan)";
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-6 text-right tabular" style={{ color: "hsl(210, 10%, 50%)" }}>{state}</span>
      <div className="flex-1 h-2 rounded-full" style={{ background: "hsl(222, 15%, 18%)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs w-10 text-right tabular" style={{ color: "hsl(210, 15%, 70%)" }}>{count.toLocaleString()}</span>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats } = useQuery<DashboardStats>({ queryKey: ["/api/dashboard"] });
  const { data: facilities = [] } = useQuery<Facility[]>({ queryKey: ["/api/facilities"] });
  const { data: activity = [] } = useQuery<ActivityLog[]>({ queryKey: ["/api/activity"] });

  const activeFacilities = facilities.filter(f => f.status === "active");
  const maxState = Math.max(...(stats?.byState.map(s => s.count) ?? [1]));

  return (
    <div className="flex h-full" style={{ background: "hsl(222, 20%, 7%)" }}>
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(222, 15%, 14%)" }}>
          <div>
            <h1 className="text-base font-semibold" style={{ color: "hsl(210, 15%, 88%)" }}>Command Center</h1>
            <p className="text-xs" style={{ color: "hsl(210, 10%, 45%)" }}>Athlete Lead Generation · {activeFacilities.length} Active Facilities</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="operational-dot w-2 h-2 rounded-full" style={{ background: "var(--color-green)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--color-green)" }}>OPERATIONAL</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard label="Total Athletes" value={(stats?.totalAthletes ?? 0).toLocaleString()} sub="across all facilities" color="hsl(210, 15%, 88%)" />
            <StatCard label="IG Matched" value={(stats?.totalMatched ?? 0).toLocaleString()} sub="confidence 60+" color="var(--color-cyan)" />
            <StatCard label="Match Rate" value={`${stats?.matchRate ?? 0}%`} sub="network average" color={stats?.matchRate && stats.matchRate >= 80 ? "var(--color-green)" : "var(--color-amber)"} />
            <StatCard label="Schools Mapped" value={(stats?.totalSchools ?? 0).toLocaleString()} sub="verified programs" />
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Facility cards */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(210, 10%, 45%)" }}>
                  Facilities ({activeFacilities.length} Active)
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {activeFacilities.map(f => <FacilityCard key={f.id} facility={f} />)}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Athletes by state */}
              <div className="rounded-xl p-4" style={{ background: "hsl(222, 18%, 10%)", border: "1px solid hsl(222, 15%, 18%)" }}>
                <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(210, 10%, 45%)" }}>
                  Athletes by State
                </h2>
                <div className="space-y-2">
                  {(stats?.byState ?? []).map(s => (
                    <StateBar key={s.state} state={s.state} count={s.count} max={maxState} />
                  ))}
                </div>
              </div>

              {/* Activity feed */}
              <div className="rounded-xl p-4" style={{ background: "hsl(222, 18%, 10%)", border: "1px solid hsl(222, 15%, 18%)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(210, 10%, 45%)" }}>
                    Agent Log
                  </h2>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-green)" }} />
                    <span className="text-xs" style={{ color: "var(--color-green)" }}>LIVE</span>
                  </span>
                </div>
                <div className="space-y-0.5 max-h-64 overflow-y-auto">
                  {activity.slice(0, 20).map(item => (
                    <ActivityItem key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
