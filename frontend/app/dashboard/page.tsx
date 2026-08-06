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

/** Header status pill — Ready / Recording / Analyzing (§3.2). */
function StatusBadge({
  isRecording,
  isAnalyzing,
}: {
  isRecording: boolean;
  isAnalyzing: boolean;
}) {
  return (
    <span className="flex h-7 items-center gap-2 rounded-full border border-border bg-elevated px-3 text-[12px] font-medium">
      {isRecording ? (
        <>
          <span
            className="h-2 w-2 animate-pulse-red rounded-full bg-danger"
            aria-hidden="true"
          />
          <span className="text-danger-bright">Recording</span>
        </>
      ) : isAnalyzing ? (
        <>
          <span
            className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary"
            aria-hidden="true"
          />
          <span className="text-muted">Analyzing</span>
        </>
      ) : (
        <>
          <span
            className="h-2 w-2 rounded-full bg-faint"
            aria-hidden="true"
          />
          <span className="text-muted">Ready</span>
        </>
      )}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [resolvedGapIds, setResolvedGapIds] = useState<Set<string>>(
    () => new Set()
  );

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
    setResolvedGapIds(new Set());
  }, []);

  /** A clarification prompt was answered — the engine gives questions the
   *  id of the gap they resolve, so mark that gap card as resolved. */
  const handlePromptAnswered = useCallback((promptId: string) => {
    setResolvedGapIds((prev) => {
      const next = new Set(prev);
      next.add(promptId);
      return next;
    });
  }, []);

  const handleSignOut = () => {
    clearToken();
    router.replace("/");
  };

  if (!authChecked) return null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6 print:hidden">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold tracking-tight text-foreground">
            Speclyn
          </span>
          <span className="hidden text-[13px] text-muted sm:inline">
            Clinical documentation intelligence
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge isRecording={isRecording} isAnalyzing={isAnalyzing} />
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:border-primary hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        {/* Left panel — 60% */}
        <section className="flex min-h-[420px] flex-col lg:max-h-[calc(100vh-56px-48px)] lg:w-[60%] print:hidden">
          <EncounterPanel
            onCompleteAnalysis={handleCompleteAnalysis}
            onRealtimeUpdate={handleRealtimeUpdate}
            onEncounterStart={handleEncounterStart}
            onAnalyzingChange={setIsAnalyzing}
            onStatusChange={setIsRecording}
            onPromptAnswered={handlePromptAnswered}
          />
        </section>

        {/* Right panel — 40% */}
        <section className="flex flex-col lg:max-h-[calc(100vh-56px-48px)] lg:w-[40%]">
          <AnalysisPanel
            analysis={analysis}
            isLoading={isAnalyzing}
            resolvedGapIds={resolvedGapIds}
          />
        </section>
      </main>
    </div>
  );
}
