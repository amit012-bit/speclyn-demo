"use client";

import type { RevenueImpact as RevenueImpactData } from "@/lib/api";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface RevenueImpactProps {
  impact: RevenueImpactData;
}

/**
 * Dollar impact display — the first thing a CFO sees. Large green range
 * at the top, per-condition breakdown and assumptions below.
 */
export default function RevenueImpact({ impact }: RevenueImpactProps) {
  const { total_range, items, assumptions } = impact;

  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        Estimated revenue impact
      </p>
      <p className="print-revenue mt-2 text-4xl font-bold leading-tight text-success xl:text-5xl">
        {usd.format(total_range.low)}
        <span className="mx-1 text-muted">–</span>
        {usd.format(total_range.high)}
      </p>
      <p className="mt-1 text-sm text-muted">per patient, annualized</p>

      {items.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-border pt-4">
          {items.map((item, i) => (
            <li
              key={`${item.condition}-${i}`}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.condition}</p>
                <p className="text-xs text-muted">{item.basis}</p>
              </div>
              <span className="shrink-0 font-semibold text-success">
                {usd.format(item.low)}–{usd.format(item.high)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {assumptions && (
        <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted">
          {assumptions}
        </p>
      )}
    </div>
  );
}
