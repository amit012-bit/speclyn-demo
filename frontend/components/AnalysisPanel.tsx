"use client";

import type { AnalysisResult, HccOpportunity } from "@/lib/api";
import RevenueImpact from "./RevenueImpact";

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  isLoading?: boolean;
  /** Gaps whose clarification prompt was answered — rendered resolved. */
  resolvedGapIds?: Set<string>;
}

function hccStatusStyle(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("captur") || s.includes("document") || s.includes("confirm")) {
    return "bg-success/10 text-success-bright border-success/40";
  }
  return "bg-warning/10 text-warning-bright border-warning/40";
}

/** 16px check icon shown before a resolved gap's condition name (§3.6). */
function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#34D399"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Skeletons mirroring the analysis content shape (§3.6) — replaces the
 *  spinner so the wait reads as "content forming", not "system busy". */
function LoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-hidden="true">
      <div className="h-10 animate-skeleton-pulse rounded-lg bg-elevated" />
      <div className="h-3 w-3/5 animate-skeleton-pulse rounded bg-elevated" />
      <div className="h-3 w-2/5 animate-skeleton-pulse rounded bg-elevated" />
      <div className="h-[72px] animate-skeleton-pulse rounded-lg bg-elevated" />
      <div className="h-[72px] animate-skeleton-pulse rounded-lg bg-elevated" />
      <p className="sr-only">Analyzing documentation…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border p-10 text-center">
      <p className="text-base font-medium text-foreground">No analysis yet</p>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
        Analyze a note or start an encounter to see specificity gaps, HCC
        opportunities, and revenue impact here.
      </p>
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
  resolvedGapIds,
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
        isLoading ? (
          <LoadingSkeleton />
        ) : (
          <EmptyState />
        )
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1">
          {/* Revenue impact — prominently at the top, large green number */}
          <RevenueImpact impact={analysis.revenue_impact} />

          {/* Specificity gaps */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-muted">
              Specificity gaps
              <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning-bright">
                {analysis.specificity_gaps.length}
              </span>
            </h3>
            {analysis.specificity_gaps.length === 0 ? (
              <p className="text-sm text-muted">
                No specificity gaps detected.
              </p>
            ) : (
              <ul className="space-y-3">
                {analysis.specificity_gaps.map((gap) => {
                  const resolved = resolvedGapIds?.has(gap.id) ?? false;
                  return (
                    <li
                      key={gap.id}
                      className={`rounded-lg border border-border border-l-[3px] bg-background p-4 transition-all duration-300 ease-in-out ${
                        resolved
                          ? "border-l-success opacity-60"
                          : "border-l-warning"
                      }`}
                    >
                      <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                        {resolved && <CheckIcon />}
                        {gap.condition}
                      </p>
                      <p className="mt-1 text-sm text-body">
                        <span className="text-muted">Missing: </span>
                        {gap.missing}
                      </p>
                      {gap.possible_codes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {gap.possible_codes.map((code) => (
                            <span
                              key={code}
                              className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-xs font-medium text-primary-bright"
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
                  );
                })}
              </ul>
            )}
          </section>

          {/* HCC opportunities */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-muted">
              HCC opportunities
              <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success-bright">
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
                    className="rounded-lg border border-border border-l-[3px] border-l-info bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-semibold text-foreground">
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
              className="w-full rounded-lg border border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-strong hover:text-white"
            >
              Export as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
