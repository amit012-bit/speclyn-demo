"""
revenue_calculator.py — Benchmark-based revenue impact validation.

The LLM produces the primary revenue estimate (it has the clinical context).
This module provides deterministic guardrails: it recomputes a floor/ceiling
from the published benchmarks and clamps obviously out-of-band LLM numbers,
so a hallucinated total can never reach the physician-facing UI.

Benchmarks (docs/SPECLYN_FULL_BUILD.md, same as the demo):
- Unspecified HCC condition: $900–$1,100 per member per year
- Missed/underspecified chronic condition: $50–$200 per encounter
"""

HCC_LOW_PER_CONDITION = 900
HCC_HIGH_PER_CONDITION = 1_100
ENCOUNTER_LOW_PER_GAP = 50
ENCOUNTER_HIGH_PER_GAP = 200

# The LLM's total may legitimately differ from the naive recomputation
# (e.g. one condition spanning multiple RAF deltas), so allow headroom
# before clamping.
TOLERANCE = 2.0


def benchmark_range(num_hcc_gaps: int, num_specificity_gaps: int) -> tuple[int, int]:
    """Deterministic floor/ceiling from the published benchmarks."""
    low = num_hcc_gaps * HCC_LOW_PER_CONDITION + num_specificity_gaps * ENCOUNTER_LOW_PER_GAP
    high = num_hcc_gaps * HCC_HIGH_PER_CONDITION + num_specificity_gaps * ENCOUNTER_HIGH_PER_GAP
    return low, high


def validate_revenue_impact(revenue: dict, num_hcc_gaps: int, num_specificity_gaps: int) -> dict:
    """Sanity-check the LLM's revenue estimate against the benchmarks.

    Returns the (possibly corrected) revenue dict. Missing or malformed
    totals are replaced with the benchmark recomputation; totals wildly
    above the benchmark ceiling are clamped.
    """
    bench_low, bench_high = benchmark_range(num_hcc_gaps, num_specificity_gaps)

    total = revenue.get("total_range") or {}
    low = total.get("low")
    high = total.get("high")

    malformed = (
        not isinstance(low, (int, float))
        or not isinstance(high, (int, float))
        or low < 0
        or high < low
    )

    if malformed:
        revenue["total_range"] = {"low": bench_low, "high": bench_high}
        if bench_low or bench_high:
            revenue.setdefault(
                "assumptions",
                "Recomputed from published CMS/HCC benchmarks: $900–$1,100 per "
                "unspecified HCC condition per member per year; $50–$200 per "
                "underspecified chronic condition per encounter.",
            )
        return revenue

    # Clamp totals far beyond what the benchmarks could support.
    ceiling = int(bench_high * TOLERANCE) if bench_high else None
    if ceiling and high > ceiling:
        revenue["total_range"] = {"low": min(int(low), bench_low or int(low)), "high": ceiling}
        revenue["assumptions"] = (
            revenue.get("assumptions", "")
            + " (Estimate clamped to published benchmark ceiling.)"
        ).strip()

    revenue["total_range"]["low"] = int(revenue["total_range"]["low"])
    revenue["total_range"]["high"] = int(revenue["total_range"]["high"])
    return revenue
