"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EncounterPanel from "@/components/EncounterPanel";
import AnalysisPanel from "@/components/AnalysisPanel";
import { clearToken, getToken, type AnalysisResult } from "@/lib/api";
import type { RealtimeAnalysis } from "@/lib/websocket";

/** Merge incremental realtime gaps into the accumulated analysis by id. */
function mergeAnalysis(
  prev: AnalysisResult | null,
  next: RealtimeAnalysis
): AnalysisResult {
  const mergeById = <T extends { id: string }>(
    a: T[] = [],
    b: T[] = []
  ): T[] => {
    const map = new Map(a.map((item) => [item.id, item]));
    for (const item of b) map.set(item.id, item);
    return Array.from(map.values());
  };

  return {
    specificity_gaps: mergeById(
      prev?.specificity_gaps,
      next.specificity_gaps
    ),
    hcc_opportunities: mergeById(
      prev?.hcc_opportunities,
      next.hcc_opportunities
    ),
    clarification_questions: mergeById(
      prev?.clarification_questions,
      next.clarification_questions
    ),
    revenue_impact: next.revenue_impact ??
      prev?.revenue_impact ?? {
        total_range: { low: 0, high: 0 },
        items: [],
        assumptions: "",
      },
    provider: next.provider ?? prev?.provider,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Protected route: no token -> back to login.
  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
    } else {
      setAuthChecked(true);
    }
  }, [router]);

  /** Complete analysis (manual note or end-of-encounter) replaces the panel. */
  const handleCompleteAnalysis = useCallback((result: AnalysisResult) => {
    setAnalysis(result);
  }, []);

  /** Realtime cycles only push new gaps — merge them in. */
  const handleRealtimeUpdate = useCallback((partial: RealtimeAnalysis) => {
    setAnalysis((prev) => mergeAnalysis(prev, partial));
  }, []);

  const handleEncounterStart = useCallback(() => {
    setAnalysis(null);
  }, []);

  const handleSignOut = () => {
    clearToken();
    router.replace("/");
  };

  if (!authChecked) return null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4 print:hidden">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold tracking-tight">Speclyn</span>
          <span className="hidden text-sm text-muted sm:inline">
            Clinical documentation intelligence
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:border-primary hover:text-foreground"
        >
          Sign out
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        {/* Left panel — 60% */}
        <section className="flex min-h-[420px] flex-col lg:w-[60%] print:hidden">
          <EncounterPanel
            onCompleteAnalysis={handleCompleteAnalysis}
            onRealtimeUpdate={handleRealtimeUpdate}
            onEncounterStart={handleEncounterStart}
            onAnalyzingChange={setIsAnalyzing}
          />
        </section>

        {/* Right panel — 40% */}
        <section className="flex flex-col lg:w-[40%]">
          <AnalysisPanel analysis={analysis} isLoading={isAnalyzing} />
        </section>
      </main>
    </div>
  );
}
