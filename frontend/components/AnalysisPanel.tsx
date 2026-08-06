"use client";

import type { AnalysisResult, HccOpportunity } from "@/lib/api";
import RevenueImpact from "./RevenueImpact";

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  isLoading?: boolean;
}

function hccStatusStyle(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("captur") || s.includes("document") || s.includes("confirm")) {
    return "bg-success/15 text-success border-success/40";
  }
  return "bg-warning/15 text-warning border-warning/40";
}

function EmptyState({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border p-10 text-center">
      {isLoading ? (
        <>
          <div
            className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
            aria-hidden="true"
          />
          <p className="text-sm text-muted">Analyzing documentation…</p>
        </>
      ) : (
        <>
          <p className="text-base font-medium text-foreground">
            No analysis yet
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
            Analyze a note or start an encounter to see specificity gaps, HCC
            opportunities, and revenue impact here.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Right-hand panel: revenue impact on top (the CFO number), then
 * specificity gaps and HCC opportunities as cards. Printable via
 * window.print() — see #analysis-print rules in globals.css.
 */
export default function AnalysisPanel({
  analysis,
  isLoading = false,
}: AnalysisPanelProps) {
  return (
    <div
      id="analysis-print"
      className="flex flex-1 flex-col rounded-xl border border-border bg-surface p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Analysis</h2>
        {analysis?.provider && (
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
            {analysis.provider}
          </span>
        )}
      </div>

      {!analysis ? (
        <EmptyState isLoading={isLoading} />
      ) : (
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
          {/* Revenue impact — prominently at the top, large green number */}
          <RevenueImpact impact={analysis.revenue_impact} />

          {/* Specificity gaps */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Specificity gaps
              <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                {analysis.specificity_gaps.length}
              </span>
            </h3>
            {analysis.specificity_gaps.length === 0 ? (
              <p className="text-sm text-muted">
                No specificity gaps detected.
              </p>
            ) : (
              <ul className="space-y-3">
                {analysis.specificity_gaps.map((gap) => (
                  <li
                    key={gap.id}
                    className="rounded-lg border border-border border-l-4 border-l-warning bg-background p-4"
                  >
                    <p className="font-semibold text-foreground">
                      {gap.condition}
                    </p>
                    <p className="mt-1 text-sm text-foreground/90">
                      <span className="text-muted">Missing: </span>
                      {gap.missing}
                    </p>
                    {gap.possible_codes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {gap.possible_codes.map((code) => (
                          <span
                            key={code}
                            className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-xs text-primary"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      {gap.why}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* HCC opportunities */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              HCC opportunities
              <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                {analysis.hcc_opportunities.length}
              </span>
            </h3>
            {analysis.hcc_opportunities.length === 0 ? (
              <p className="text-sm text-muted">
                No HCC opportunities detected.
              </p>
            ) : (
              <ul className="space-y-3">
                {analysis.hcc_opportunities.map((hcc: HccOpportunity) => (
                  <li
                    key={hcc.id}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-foreground">
                        {hcc.condition}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${hccStatusStyle(hcc.status)}`}
                      >
                        {hcc.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {hcc.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Export — window.print() + print stylesheet for the pilot */}
          <div className="print-hide mt-auto border-t border-border pt-4">
            <button
              onClick={() => window.print()}
              className="w-full rounded-lg border border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
            >
              Export as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
