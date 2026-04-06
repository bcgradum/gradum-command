import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/command/Sidebar";
import PipelinePanel from "@/components/command/PipelinePanel";
import type { Facility, Athlete, ActivityLog } from "@shared/schema";

interface FacilityStats {
  totalAthletes: number; matched: number; lowConfidence: number; reviewQueue: number;
  notFound: number; primaryZone: number; secondaryZone: number; extendedZone: number;
  byGradYear: { year: number; count: number }[];
  bySchool: { school: string; count: number }[];
  matchRate: number;
}

const IG_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  matched: { label: "Verified", color: "#4caf7d", bg: "rgba(76,175,125,0.12)" },
  low_confidence: { label: "Low Conf", color: "#f5a623", bg: "rgba(245,166,35,0.12)" },
  review: { label: "Review", color: "#e67e22", bg: "rgba(230,126,34,0.12)" },
  not_found: { label: "Not Found", color: "#f45c6b", bg: "rgba(244,92,107,0.12)" },
  not_searched: { label: "Pending", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span style={{ color: "hsl(210, 10%, 35%)" }}>—</span>;
  const color = score >= 80 ? "#4caf7d" : score >= 60 ? "#f5a623" : score >= 50 ? "#e67e22" : "#f45c6b";
  return <span className="tabular text-xs font-bold" style={{ color }}>{score}</span>;
}

function AthleteRow({ athlete, onPromote }: { athlete: Athlete; onPromote: (id: number) => void }) {
  const status = IG_STATUS_LABELS[athlete.igStatus] ?? { label: athlete.igStatus, color: "#6b7280", bg: "transparent" };
  return (
    <tr data-testid={`row-athlete-${athlete.id}`} style={{ borderBottom: "1px solid hsl(222, 15%, 16%)" }}
      className="hover:bg-white/[0.02] transition-colors">
      <td className="py-2.5 px-3">
        <div className="text-sm font-medium" style={{ color: "hsl(210, 15%, 85%)" }}>{athlete.fullName}</div>
        <div className="text-xs" style={{ color: "hsl(210, 10%, 42%)" }}>{athlete.schoolName || athlete.travelTeam || "—"}</div>
      </td>
      <td className="py-2.5 px-3 text-xs tabular" style={{ color: "hsl(210, 10%, 55%)" }}>{athlete.gradYear || "—"}</td>
      <td className="py-2.5 px-3 text-xs" style={{ color: "hsl(210, 10%, 55%)" }}>{athlete.position || "—"}</td>
      <td className="py-2.5 px-3">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: athlete.sport === "softball" ? "rgba(155,89,182,0.15)" : "rgba(52,152,219,0.15)", color: athlete.sport === "softball" ? "#9b59b6" : "#3498db" }}>
          {athlete.sport}
        </span>
      </td>
      <td className="py-2.5 px-3">
        {athlete.igHandle ? (
          <span className="text-xs font-mono" style={{ color: "var(--color-cyan)" }}>@{athlete.igHandle}</span>
        ) : (
          <span style={{ color: "hsl(210, 10%, 35%)" }}>—</span>
        )}
      </td>
      <td className="py-2.5 px-3"><ConfidenceBadge score={athlete.igConfidence} /></td>
      <td className="py-2.5 px-3">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: status.bg, color: status.color }}>
          {status.label}
        </span>
      </td>
      <td className="py-2.5 px-3">
        {(athlete.igStatus === "low_confidence" || athlete.igStatus === "review") && (
          <button onClick={() => onPromote(athlete.id)}
            className="text-xs px-2 py-0.5 rounded transition-colors"
            style={{ background: "var(--color-cyan-dim)", color: "var(--color-cyan)", border: "1px solid var(--color-cyan-border)" }}
            data-testid={`button-promote-${athlete.id}`}>
            Promote
          </button>
        )}
      </td>
    </tr>
  );
}

export default function FacilityDetail() {
  const [, params] = useRoute("/facility/:id");
  const facilityId = Number(params?.id);
  const qc = useQueryClient();

  const [tab, setTab] = useState<"all" | "matched" | "low" | "review" | "not_found">("all");
  const [sport, setSport] = useState<string>("");
  const [gradYear, setGradYear] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: facility } = useQuery<Facility>({ queryKey: ["/api/facilities", facilityId] });
  const { data: stats } = useQuery<FacilityStats>({
    queryKey: ["/api/facilities", facilityId, "stats"],
    queryFn: async () => { const r = await fetch(`/api/facilities/${facilityId}/stats`); return r.json(); },
  });
  const { data: activity = [] } = useQuery<ActivityLog[]>({
    queryKey: ["/api/facilities", facilityId, "activity"],
    queryFn: async () => { const r = await fetch(`/api/facilities/${facilityId}/activity`); return r.json(); },
  });

  // Build filters from tab
  const filters: any = {};
  if (tab === "matched") { filters.minConfidence = 60; }
  if (tab === "low") { filters.minConfidence = 50; filters.maxConfidence = 59; }
  if (tab === "review") { filters.igStatus = "review"; }
  if (tab === "not_found") { filters.igStatus = "not_found"; }
  if (sport) filters.sport = sport;
  if (gradYear) filters.gradYear = Number(gradYear);
  if (search) filters.search = search;

  const queryStr = new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)])).toString();
  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/facilities", facilityId, "athletes", queryStr],
    queryFn: async () => { const r = await fetch(`/api/facilities/${facilityId}/athletes?${queryStr}`); return r.json(); },
  });

  const promoteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/athletes/${id}/ig`, { igStatus: "matched", igConfidence: 65 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/facilities", facilityId] }); },
  });

  const stateColors: Record<string, string> = { FL: "#3498db", TX: "#f5a623", NC: "#4caf7d", SC: "#9b59b6", GA: "#e74c3c", OK: "#e67e22", UT: "#1abc9c" };
  const stateColor = facility ? stateColors[facility.state] || "var(--color-cyan)" : "var(--color-cyan)";

  const tabs = [
    { key: "all", label: "All Athletes", count: stats?.totalAthletes },
    { key: "matched", label: "Outreach List", count: stats?.matched },
    { key: "low", label: "Low Confidence", count: stats?.lowConfidence },
    { key: "review", label: "Review Queue", count: stats?.reviewQueue },
    { key: "not_found", label: "Not Found", count: stats?.notFound },
  ];

  return (
    <div className="flex h-full" style={{ background: "hsl(222, 20%, 7%)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(222, 15%, 14%)" }}>
          <div className="flex items-center gap-3">
            <Link href="/"><a className="text-xs" style={{ color: "hsl(210, 10%, 45%)" }}>← Overview</a></Link>
            <span style={{ color: "hsl(222, 15%, 25%)" }}>·</span>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: `${stateColor}20`, color: stateColor }}>
                {facility?.state}
              </span>
              <h1 className="text-base font-semibold" style={{ color: "hsl(210, 15%, 88%)" }}>
                {facility?.locationName?.replace("Gradum ", "")}
              </h1>
              <span className="text-xs" style={{ color: "hsl(210, 10%, 42%)" }}>{facility?.igAccount}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-right">
              <span className="tabular font-bold" style={{ color: "var(--color-cyan)" }}>{stats?.matchRate ?? 0}%</span>
              <span style={{ color: "hsl(210, 10%, 45%)" }}> match rate</span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-7 gap-0" style={{ borderBottom: "1px solid hsl(222, 15%, 14%)" }}>
          {[
            { label: "Total", value: stats?.totalAthletes ?? 0, color: "hsl(210, 15%, 88%)" },
            { label: "Matched (60+)", value: stats?.matched ?? 0, color: "var(--color-cyan)" },
            { label: "Low Conf (50-59)", value: stats?.lowConfidence ?? 0, color: "var(--color-amber)" },
            { label: "Review Queue", value: stats?.reviewQueue ?? 0, color: "#e67e22" },
            { label: "Primary Zone", value: stats?.primaryZone ?? 0, color: "var(--color-green)" },
            { label: "Secondary Zone", value: stats?.secondaryZone ?? 0, color: "hsl(210, 10%, 55%)" },
            { label: "Not Found", value: stats?.notFound ?? 0, color: "var(--color-red)" },
          ].map((s, i) => (
            <div key={i} className="px-4 py-3 text-center" style={{ borderRight: i < 6 ? "1px solid hsl(222, 15%, 14%)" : "none" }}>
              <div className="text-xs" style={{ color: "hsl(210, 10%, 40%)" }}>{s.label}</div>
              <div className="text-xl font-bold tabular" style={{ color: s.color }}>{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid hsl(222, 15%, 14%)" }}>
              {/* Tabs */}
              <div className="flex gap-1 mr-2">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key as any)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{
                      background: tab === t.key ? "var(--color-cyan-dim)" : "transparent",
                      color: tab === t.key ? "var(--color-cyan)" : "hsl(210, 10%, 45%)",
                      border: tab === t.key ? "1px solid var(--color-cyan-border)" : "1px solid transparent",
                    }}
                    data-testid={`tab-${t.key}`}>
                    {t.label} <span className="ml-1 tabular">{t.count ?? 0}</span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, school, handle..." className="flex-1 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "hsl(222, 15%, 14%)", border: "1px solid hsl(222, 15%, 18%)", color: "hsl(210, 15%, 88%)", outline: "none" }}
                data-testid="input-search" />

              <select value={sport} onChange={e => setSport(e.target.value)} className="px-2 py-1.5 rounded-lg text-xs"
                style={{ background: "hsl(222, 15%, 14%)", border: "1px solid hsl(222, 15%, 18%)", color: "hsl(210, 10%, 55%)" }}
                data-testid="select-sport">
                <option value="">All Sports</option>
                <option value="baseball">Baseball</option>
                <option value="softball">Softball</option>
              </select>

              <select value={gradYear} onChange={e => setGradYear(e.target.value)} className="px-2 py-1.5 rounded-lg text-xs"
                style={{ background: "hsl(222, 15%, 14%)", border: "1px solid hsl(222, 15%, 18%)", color: "hsl(210, 10%, 55%)" }}
                data-testid="select-year">
                <option value="">All Years</option>
                {[2026, 2027, 2028, 2029, 2030, 2031, 2032].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "hsl(222, 20%, 8%)" }}>
                  <tr style={{ borderBottom: "1px solid hsl(222, 15%, 18%)" }}>
                    {["Athlete", "Year", "Pos", "Sport", "IG Handle", "Score", "Status", "Action"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(210, 10%, 40%)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {athletes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm" style={{ color: "hsl(210, 10%, 35%)" }}>
                        No athletes found for this filter
                      </td>
                    </tr>
                  ) : (
                    athletes.map(a => (
                      <AthleteRow key={a.id} athlete={a} onPromote={id => promoteMutation.mutate(id)} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right panel - Activity + school stats */}
          <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden" style={{ borderLeft: "1px solid hsl(222, 15%, 14%)" }}>
            {/* Pipeline Controls */}
            {facility && stats && (
              <div className="p-4" style={{ borderBottom: "1px solid hsl(222, 15%, 14%)" }}>
                <PipelinePanel
                  facilityId={facilityId}
                  facilityName={facility.locationName}
                  totalAthletes={stats.totalAthletes}
                  notSearchedCount={Math.max(0, stats.totalAthletes - stats.matched - stats.lowConfidence)}
                />
              </div>
            )}

            {/* Top schools */}
            <div className="p-4" style={{ borderBottom: "1px solid hsl(222, 15%, 14%)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(210, 10%, 40%)" }}>Top Schools</h3>
              <div className="space-y-2">
                {(stats?.bySchool ?? []).slice(0, 6).map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs truncate" style={{ color: "hsl(210, 15%, 75%)" }}>{s.school}</span>
                    <span className="text-xs tabular ml-2 shrink-0" style={{ color: "var(--color-cyan)" }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grad year distribution */}
            <div className="p-4" style={{ borderBottom: "1px solid hsl(222, 15%, 14%)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(210, 10%, 40%)" }}>By Grad Year</h3>
              <div className="space-y-1.5">
                {(stats?.byGradYear ?? []).map(g => {
                  const max = Math.max(...(stats?.byGradYear.map(x => x.count) ?? [1]));
                  const pct = (g.count / max) * 100;
                  return (
                    <div key={g.year} className="flex items-center gap-2">
                      <span className="text-xs w-10 tabular" style={{ color: "hsl(210, 10%, 45%)" }}>{g.year}</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: "hsl(222, 15%, 18%)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-cyan)" }} />
                      </div>
                      <span className="text-xs w-8 text-right tabular" style={{ color: "hsl(210, 10%, 55%)" }}>{g.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity feed */}
            <div className="flex-1 overflow-hidden p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(210, 10%, 40%)" }}>Agent Log</h3>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-green)" }} />
                  <span className="text-xs" style={{ color: "var(--color-green)" }}>LIVE</span>
                </span>
              </div>
              <div className="space-y-0.5 overflow-y-auto max-h-full terminal-log">
                {activity.slice(0, 20).map(item => {
                  const typeColors: Record<string, string> = { school_scan: "#9b59b6", roster_pull: "#3498db", ig_match: "var(--color-cyan)", system: "var(--color-green)", error: "var(--color-red)" };
                  const color = typeColors[item.type] || "hsl(210, 10%, 45%)";
                  const time = new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                  return (
                    <div key={item.id} className="py-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: "hsl(210, 10%, 35%)" }}>{time}</span>
                        {item.count !== null && <span className="text-xs tabular font-bold" style={{ color }}>{item.count.toLocaleString()}</span>}
                      </div>
                      <div className="text-xs" style={{ color: "hsl(210, 10%, 60%)" }}>{item.message}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
