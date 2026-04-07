import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PipelinePanelProps {
  facilityId: number;
  facilityName: string;
  totalAthletes: number;
  notSearchedCount: number;
}

export default function PipelinePanel({ facilityId, facilityName, totalAthletes, notSearchedCount }: PipelinePanelProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [igRunning, setIgRunning] = useState(false);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // IG Batch Match — no limit dropdown, always run on ALL unmatched athletes
  const igBatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pipeline/ig-match-batch/${facilityId}?limit=9999`, { method: "POST" });
      return res.json();
    },
    onMutate: () => setIgRunning(true),
    onSuccess: (data) => {
      setLastResult(`IG match running: ${data.queued} athletes queued. Results appear in the agent log.`);
      toast({ title: "IG Match Running", description: `Matching ${data.queued} athletes using Claude AI. Check the agent log for results.` });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["/api/facilities", facilityId] });
        qc.invalidateQueries({ queryKey: ["/api/facilities", facilityId, "stats"] });
        setIgRunning(false);
      }, Math.min(data.queued * 600 + 3000, 120000));
    },
    onError: (err: any) => {
      setIgRunning(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  // Full Athlete Discovery (replaces School Discovery)
  const discoveryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pipeline/discover-schools/${facilityId}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onMutate: () => setDiscoveryRunning(true),
    onSuccess: (data) => {
      setLastResult(`Full Athlete Discovery started (Run ID: ${data.runId}). Apify is scanning all 20 sources for grad years 2026-2032 within 40 miles. Results appear in the Agent Log.`);
      toast({ title: "Athlete Discovery Started", description: "Apify is scanning all 20 sources near this facility. Run ID: " + data.runId });
      setTimeout(() => setDiscoveryRunning(false), 5000);
    },
    onError: (err: any) => {
      setDiscoveryRunning(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(222, 15%, 18%)" }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "hsl(222, 18%, 11%)", borderBottom: "1px solid hsl(222, 15%, 18%)" }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(210, 15%, 75%)" }}>Pipeline Controls</span>
        </div>
        <span className="text-xs" style={{ color: "hsl(210, 10%, 40%)" }}>{facilityName.replace("Gradum ", "")}</span>
      </div>

      <div className="p-4 space-y-4" style={{ background: "hsl(222, 18%, 10%)" }}>
        {/* IG Matching with Claude — no batch size dropdown */}
        <div className="rounded-lg p-3" style={{ background: "hsl(222, 15%, 14%)", border: "1px solid hsl(222, 15%, 18%)" }}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-xs font-semibold" style={{ color: "hsl(210, 15%, 80%)" }}>IG Handle Matching</div>
              <div className="text-xs mt-0.5" style={{ color: "hsl(210, 10%, 42%)" }}>
                Claude generates username patterns · {notSearchedCount} athletes unmatched
              </div>
            </div>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--color-cyan-dim)", color: "var(--color-cyan)" }}>
              Claude AI
            </span>
          </div>
          <button
            onClick={() => igBatchMutation.mutate()}
            disabled={igRunning || notSearchedCount === 0}
            className="w-full py-1.5 rounded text-xs font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              background: igRunning ? "hsl(222, 15%, 18%)" : "var(--color-cyan-dim)",
              color: igRunning ? "hsl(210, 10%, 40%)" : "var(--color-cyan)",
              border: `1px solid ${igRunning ? "hsl(222, 15%, 22%)" : "var(--color-cyan-border)"}`,
              cursor: (igRunning || notSearchedCount === 0) ? "not-allowed" : "pointer",
            }}
            data-testid="button-run-ig-match"
          >
            {igRunning ? (
              <>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--color-cyan)" }} />
                Running...
              </>
            ) : "Run IG Match"}
          </button>
        </div>

        {/* Run Full Athlete Discovery */}
        <div className="rounded-lg p-3" style={{ background: "hsl(222, 15%, 14%)", border: "1px solid hsl(222, 15%, 18%)" }}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-xs font-semibold" style={{ color: "hsl(210, 15%, 80%)" }}>Run Full Athlete Discovery</div>
              <div className="text-xs mt-0.5" style={{ color: "hsl(210, 10%, 42%)" }}>
                Hits all 20 sources — Perfect Game, PBR, USSSA, MaxPreps, GameChanger, Softball Factory, NCSA, HSBN, FieldLevel, Extra Innings Softball, SportsRecruits, Five Star Preps, school rosters, and travel ball databases — for grad years 2026-2032 within 40 miles
              </div>
            </div>
            <span className="text-xs px-1.5 py-0.5 rounded shrink-0 ml-2" style={{ background: "rgba(245,166,35,0.12)", color: "var(--color-amber)" }}>
              Apify
            </span>
          </div>
          <button
            onClick={() => discoveryMutation.mutate()}
            disabled={discoveryRunning}
            className="w-full py-1.5 rounded text-xs font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              background: discoveryRunning ? "hsl(222, 15%, 18%)" : "rgba(245,166,35,0.1)",
              color: discoveryRunning ? "hsl(210, 10%, 40%)" : "var(--color-amber)",
              border: `1px solid ${discoveryRunning ? "hsl(222, 15%, 22%)" : "rgba(245,166,35,0.25)"}`,
              cursor: discoveryRunning ? "not-allowed" : "pointer",
            }}
            data-testid="button-discover-athletes"
          >
            {discoveryRunning ? (
              <>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--color-amber)" }} />
                Starting Apify Run...
              </>
            ) : "Run Full Athlete Discovery"}
          </button>
        </div>

        {/* Result message */}
        {lastResult && (
          <div className="text-xs p-2 rounded" style={{ background: "hsl(222, 15%, 14%)", color: "hsl(210, 10%, 55%)", border: "1px solid hsl(222, 15%, 18%)" }}>
            {lastResult}
          </div>
        )}

        {/* Info */}
        <div className="text-xs" style={{ color: "hsl(210, 10%, 35%)" }}>
          Results appear in the Agent Log. Verified handles go to the Outreach List automatically.
        </div>
      </div>
    </div>
  );
}
