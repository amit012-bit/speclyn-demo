"use client";

import { useEffect, useState } from "react";
import type { RevenueImpact as RevenueImpactData } from "@/lib/api";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const COUNT_UP_MS = 800;

/**
 * Count both bounds 0→value over 800ms (requestAnimationFrame, ease-out
 * cubic). Skipped entirely under prefers-reduced-motion — the final value
 * renders immediately (§3.6).
 */
function useCountUp(low: number, high: number): { low: number; high: number } {
  const [display, setDisplay] = useState({ low: 0, high: 0 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay({ low, high });
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / COUNT_UP_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay({
        low: Math.round(low * eased),
        high: Math.round(high * eased),
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [low, high]);

  return display;
}

interface RevenueImpactProps {
  impact: RevenueImpactData;
}

/**
 * Dollar impact display — the first thing a CFO sees. Large green range
 * at the top, per-condition breakdown and assumptions below.
 */
export default function RevenueImpact({ impact }: RevenueImpactProps) {
  const { total_range, items, assumptions } = impact;
  const animated = useCountUp(total_range.low, total_range.high);

  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        Estimated revenue impact
      </p>
      <p className="print-revenue mt-2 text-4xl font-bold leading-10 tracking-[-0.01em] text-success-bright tabular-nums xl:text-[44px] xl:leading-[48px]">
        {usd.format(animated.low)}
        <span className="mx-1 text-muted">–</span>
        {usd.format(animated.high)}
      </p>
      <p className="mt-1 text-[13px] text-muted">per patient, annualized</p>

      {items.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-border pt-4">
          {items.map((item, i) => (
            <li
              key={`${item.condition}-${i}`}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.condition}</p>
                <p className="font-mono text-xs text-muted">{item.basis}</p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-success-bright tabular-nums">
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
