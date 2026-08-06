# SPECLYN — Design Specification v1.0
## Design review + refined system, grounded in research and computed WCAG math
### Supersedes conflicting values in `docs/SPECLYN_UI_UX_GUIDE.md`. Written for direct execution by an implementation agent — no further judgment calls required.

Reviewed against:
- Founder guide: `docs/SPECLYN_UI_UX_GUIDE.md`
- Implementation: `frontend/app/page.tsx`, `frontend/app/dashboard/page.tsx`, `frontend/app/globals.css`, `frontend/tailwind.config.ts`, `frontend/components/{EncounterPanel,LiveTranscript,PromptCard,AnalysisPanel,RevenueImpact,VoiceRecorder}.tsx`

All contrast ratios below were computed with the WCAG 2.x relative-luminance formula (not estimated). WCAG AA thresholds: 4.5:1 normal text, 3:1 large text (≥24px, or ≥18.66px bold), 3:1 for non-text UI component indicators (SC 1.4.11). Values are thresholds — 4.49:1 fails.

---

# 1. CRITIQUE OF THE FOUNDER'S GUIDE

## 1.1 Keep — these are right, and research backs them

| Guide decision | Verdict | Why |
|---|---|---|
| Three principles (trust over flash / zero cognitive load / colleague not compliance tool) | **KEEP** | Matches Abridge's stated CDS design criteria exactly: "trusted evidence embedded in real-time workflows," contextual relevance, in-workflow surfacing rather than app-switching. This is the industry-leader playbook. |
| Max ONE PromptCard visible, queue the rest | **KEEP — this is the single most defensible decision in the guide** | Alert-fatigue research: likelihood of reminder acceptance drops ~30% for each additional reminder per encounter (Ancker et al., JAMIA 2017). One-at-a-time is not a style choice; it is the adoption-critical behavior. |
| Dark near-black base (not pure #000), off-white text (not pure #FFF) | **KEEP** | Pure white on pure black (21:1) causes halation for users with astigmatism; best practice is off-white (#E0E0E0–#F0F0F0) on dark gray. Both palettes already do this. |
| Uppercase, letter-spaced section headers | KEEP | Cheap, consistent "instrument panel" signal. Exact values in §2.3. |
| Empty states for every panel, skeleton loading | KEEP | Current implementation uses a spinner instead of skeletons — fix in P1. |
| No gradients on interactive elements, ≤300ms motion cap | KEEP | Codified in §2.6 with a `prefers-reduced-motion` gate the guide omitted. |
| Semantic tint backgrounds at ~8% alpha | KEEP | Matches Material dark-theme practice of dim containers + brighter foregrounds. |
| Print-based PDF export | KEEP | Already implemented in `globals.css` / `AnalysisPanel.tsx`; works. |
| Real placeholder content, no raw JSON, no blocking spinners, Dialog over alert() | KEEP | No changes. |

## 1.2 Change — where the guide is wrong, with evidence

**C1. The guide's palette fails WCAG AA in four places. Replace it with the refined token set in §2.1 (which keeps the implementation's base hexes).**
Computed ratios for the guide's own pairs:
- `--text-tertiary #4A5169` on `#0C0E14` = **2.45:1**, on `#13161F` = **2.30:1** — fails AA for everything, including the placeholders and 12px footer text the guide assigns it to. (Disabled controls are exempt; placeholders are not.)
- White text on `--brand-primary #4F7EF7` = **3.71:1** — every filled primary button in the guide fails AA at its specified 13–14px sizes.
- `--revenue-green #10F28A` passes numerically (12.94:1) but is a maximally-saturated neon. Material's dark-theme guidance is explicit: use desaturated tones on dark surfaces; saturated colors "vibrate" and cause optical halation. Replace with `#34D399` (9.82:1) — still unmistakably green money, no glow.
- `--text-secondary #8B92A8` on `--bg-elevated #1A1E2A` = 5.36:1 — passes, but thin margin once you tint hovers. The refined `#9CA3AF` gives 6.6–7.4:1 everywhere.

**C2. JetBrains Mono for transcript prose — rejected.**
Monospace slows continuous-prose reading and the NN/g dark-mode research shows small text is disproportionately penalized on dark backgrounds. Live-caption UX practice (Smashing Magazine; caption vendors) uses proportional sans for running speech. The "clinical document writing itself" feeling comes from the streaming behavior and the cursor, not the font. **Decision: transcript prose = Inter 15px/1.7; JetBrains Mono reserved for ICD codes, dollar bases, and clinical data tokens only.**

**C3. 30-second auto-dismiss with visible countdown on PromptCard — rejected.**
A countdown adds time pressure — the opposite of "zero cognitive load" — and silently discarding a clinically relevant question mid-conversation trains distrust. CDS-stewardship literature: interruptive alerts carry an immediate cognitive-burden cost and a long-term receptiveness cost; the goal is minimum interruption with zero loss of signal. **Decision: after 45s of no interaction the card collapses into a persistent queue chip ("1 clarification waiting") instead of vanishing. No countdown UI. Spec in §3.5.**

**C4. Three-column 20/50/30 layout — rejected. Keep the implemented two-column 60/40.**
A permanent 20% control rail holds two buttons and three stats — dead space that adds a third region to scan during an encounter. The guide's own principle #2 argues against it. Abridge/DAX converge on a "conversation + output" two-region model. **Decision: two columns (Encounter 60% / Analysis 40%); Start/Stop lives in the encounter panel header (as implemented); session stats become a compact stat row inside the encounter panel (§3.3); status badge goes in the app header (§3.2).**

**C5. DM Serif Display for revenue numbers — rejected.**
Dollar figures need lining tabular numerals so digits align and the range reads instantly; a display serif is decoration on the one element the guide itself says must "hit you immediately." **Decision: revenue number = Inter 700 with `font-variant-numeric: tabular-nums` (§3.6). DM Serif Display survives only as the "Speclyn" wordmark (P2, optional).**

**C6. "New words fade in one by one" — amended to segment-level.**
Real streaming STT (AssemblyAI Universal-Streaming — the planned Phase 4 provider) emits **immutable partial segments** then finalized turns, not word deltas; vendor guidance is "render partials immediately, commit the formatted line when the turn finalizes." The correct pattern is a two-state text treatment (partial = dimmed, final = full color), not per-word animation. Spec in §3.4. All motion gated by `prefers-reduced-motion`.

**C7. "Do not use box shadows — use borders instead" — softened.**
Correct for resting cards (shadows are nearly invisible on dark themes; Material conveys dark-theme elevation by lightening surfaces). But floating overlays need separation from content they occlude. **Decision: exactly one shadow token, used only by PromptCard and Dialogs (§2.5).**

**C8. The guide contradicts itself on emoji** — it bans emoji in production UI, then specs "💬" inside PromptCard. The ban is right (emoji render inconsistently cross-platform and read as consumer-grade). The current `PromptCard.tsx` line 63 ships the 💬. **Decision: inline SVG chat icon (§3.5). P0.**

## 1.3 Bugs found in the current implementation (independent of the guide)

| # | File | Issue | Computed ratio | Fix |
|---|---|---|---|---|
| B1 | `page.tsx`, `EncounterPanel.tsx`, `PromptCard.tsx`, `VoiceRecorder.tsx` | White text on `bg-primary #3B82F6` filled buttons | **3.68:1 — FAILS AA** at 14px | Filled buttons use `#2563EB` (white = 5.17:1) |
| B2 | `page.tsx`, `EncounterPanel.tsx`, `VoiceRecorder.tsx` | `placeholder-muted/60` = #9CA3AF at 60% over dark bg | **3.42:1 / 3.24:1 — FAILS AA** | Full-opacity `#9CA3AF` placeholders (7.43:1) |
| B3 | `PromptCard.tsx` | Label `text-primary #3B82F6` on `bg-gray-50` | **3.52:1 — FAILS AA** at 14px | Label `#1D4ED8` (6.70:1 on white) |
| B4 | `PromptCard.tsx` | Skip button `text-gray-500 #6B7280` on gray-50 | 4.63:1 — passes by 0.13 | Use `#4B5563` (7.23:1) |
| B5 | global | Focus ring `ring-primary/40` — semi-transparent blue over dark ≈ well under 3:1 | fails SC 1.4.11 | Global `:focus-visible` 2px solid `#60A5FA` (7.42:1 vs base), offset 2px |
| B6 | `LiveTranscript.tsx` | `scrollTop = scrollHeight` on every update — user can never scroll back during recording | UX bug | Stick-to-bottom only when already near bottom; "Jump to live" pill otherwise (§3.4) |
| B7 | `LiveTranscript.tsx` | `aria-live="polite"` on the full re-rendered transcript will re-announce everything to screen readers | a11y bug | `role="log"`; only finalized segments in the live region; partial span `aria-hidden` (§3.4) |
| B8 | `PromptCard.tsx` | 💬 emoji in production UI | — | Inline SVG (§3.5) |
| B9 | `page.tsx` login | Wrong-password error styled as `warning` | semantic | Error = danger tokens (§3.1) |

---

# 2. REFINED DESIGN SYSTEM

## 2.1 Color tokens — final

Keep the implementation's four structural hexes (already good); extend with the roles both the guide and implementation were missing. Every text/background pair is listed with its computed WCAG ratio. Add to `tailwind.config.ts` `theme.extend.colors` (names given), and mirror as CSS variables in `globals.css` if desired.

### Backgrounds & borders

| Token (Tailwind name) | Hex | Use | Notes |
|---|---|---|---|
| `background` | `#0F1117` | Page, inset wells (transcript, inputs) | KEEP |
| `surface` | `#1A1D27` | Panels, cards | KEEP |
| `elevated` | `#232734` | Hover states, dropdowns, chips | NEW — dark-theme elevation = lighter surface, not shadow |
| `border` | `#2D3748` | Decorative dividers, resting card borders | KEEP. 1.57:1 vs background — allowed: decorative borders are exempt from SC 1.4.11 |
| `border-strong` | `#6B7280` | Borders that alone identify a control (text inputs, textarea) | NEW — 3.90:1 vs `background`, 3.47:1 vs `surface` → passes SC 1.4.11 (3:1) |

### Text

| Token | Hex | On `#0F1117` | On `#1A1D27` | Use |
|---|---|---|---|---|
| `foreground` | `#F9FAFB` | **18.06:1** | **16.09:1** | Headings, button labels, key figures, condition names |
| `body` | `#E5E7EB` | **15.24:1** | **13.58:1** | NEW — long-form prose: transcript, paragraphs, note textarea. Slightly softer than foreground to reduce halation on sustained reading (dark-mode a11y best practice: body text below max contrast) |
| `muted` | `#9CA3AF` | **7.43:1** | **6.62:1** | Labels, metadata, placeholders (full opacity — never `/60`) |
| `faint` | `#6B7280` | 3.90:1 | 3.47:1 | Disabled text ONLY (SC 1.4.3 exempts disabled). Never for readable content |

### Brand / interactive

| Token | Hex | Ratio (context) | Use |
|---|---|---|---|
| `primary` | `#3B82F6` | 5.13:1 on background | KEEP — icons, borders, accents, large text |
| `primary-strong` | `#2563EB` | white on it = **5.17:1** | NEW — the ONLY filled-button background. Replaces every `bg-primary` button |
| `primary-bright` | `#60A5FA` | **7.42:1** on background, **6.61:1** on surface | NEW — links, focus rings, ICD code chips, small blue text |

### Semantic (pattern: `-600/base` for fills+borders, `-bright` for text on dark)

| Token | Hex | Ratio on background / surface | Use |
|---|---|---|---|
| `success` | `#10B981` | 7.44 / 6.63 | KEEP — icons, borders, badges |
| `success-bright` | `#34D399` | **9.82 / 8.75** | Success TEXT on dark; **the revenue number** |
| `warning` | `#F59E0B` | 8.79 / 7.83 | KEEP — gap-card left borders, icons |
| `warning-bright` | `#FBBF24` | **11.30 / 10.07** | Warning TEXT on dark (badge counts, queue chip) |
| `danger` | `#EF4444` | 5.01 on background | Recording dot, error borders/icons |
| `danger-bright` | `#F87171` | **6.82 / 6.08** | Error TEXT, "Recording"/"LIVE" labels |
| `danger-strong` | `#DC2626` | white on it = **4.83:1** | Stop Encounter filled button. Hover `#B91C1C` |
| `info` | `#38BDF8` | 9.01 / 7.85 | HCC opportunity accents (adopted from guide — good idea) |

Semantic tint backgrounds: `success/10`, `warning/10`, `danger/10`, `info/10` (Tailwind alpha on the base tokens) with matching `/40` borders — keeps the guide's 8–10% pattern.

### PromptCard "light island" (deliberate polarity inversion — see §3.5)

| Element | Hex | Ratio | |
|---|---|---|---|
| Card background | `#FFFFFF` | — | on dark UI ⇒ maximum salience with zero motion cost |
| Question text | `#111827` | **17.74:1** | |
| Supporting text | `#374151` | **10.31:1** | |
| Label ("Quick clarification") | `#1D4ED8` | **6.70:1** | |
| Skip button text | `#4B5563` | **7.23:1** | hover bg `#E5E7EB`, hover text `#111827` |
| Primary button | bg `#2563EB`, text `#FFFFFF` | **5.17:1** | |

## 2.2 Do NOT adopt from the guide
`#4A5169` (tertiary text — 2.3:1), `#4F7EF7` as filled-button bg (3.71:1 w/ white), `#10F28A` (neon), DM Serif for numerals, `#0C0E14/#13161F` base swap (no benefit over current hexes; churn without gain).

## 2.3 Typography scale — final (all Inter unless noted; load via `next/font/google`)

| Style | Size/Line | Weight | Extras | Use |
|---|---|---|---|---|
| `display` | 36px/40px (xl: 44px/48px) | 700 | `tabular-nums`, tracking -0.01em | Revenue number |
| `h1` | 24px/32px | 700 | tracking -0.01em | Login wordmark area, page titles |
| `h2` | 18px/28px | 600 | | Panel titles ("Current Encounter", "Analysis") |
| `section` | 13px/16px | 600 | UPPERCASE, tracking 0.05em, color `muted` | "SPECIFICITY GAPS", "ESTIMATED REVENUE IMPACT" |
| `card-title` | 15px/20px | 600 | color `foreground` | Gap/HCC condition names |
| `body` | 14px/20px | 400 | | Default UI text |
| `transcript` | 15px/25.5px (1.7) | 400 | color `body`, tracking 0.01em | Live transcript prose |
| `small` | 13px/18px | 400 | | Sub-text, descriptions |
| `caption` | 12px/16px | 400 | color `muted` | Timestamps, assumptions, "why" lines |
| `label` | 11px/14px | 600 | UPPERCASE, tracking 0.08em | Badges, stat labels |
| `code` | 13px/18px | 500 | JetBrains Mono | ICD codes, HCC codes, clinical tokens |

Max 3 weights per component (guide rule — keep). Fonts: Inter (400, 500, 600, 700), JetBrains Mono (500). DM Serif Display only if P2 wordmark item is executed.

## 2.4 Spacing & radius

- Base grid 4px. Only use: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Panel padding: 24px (`p-6`). Card padding: 16px (`p-4`). Compact rows/chips: 8px 12px.
- Stack gaps: 12px inside cards, 16px between cards, 24px between sections/panels.
- Radius: cards/panels 12px (`rounded-xl`), inputs/buttons 8px (`rounded-lg`), chips/code tags 6px (`rounded-md`), pills/dots `rounded-full`.
- Control heights: buttons 40px (`h-10`), compact buttons 36px, inputs 44px, header 56px (`h-14`).

## 2.5 Elevation

| Level | Recipe | Used by |
|---|---|---|
| 0 | `background` | Page, inset wells |
| 1 | `surface` + 1px `border` | Panels, cards |
| 2 | `elevated` + 1px `border` | Hover, dropdowns, chips |
| Overlay | `#FFFFFF` (PromptCard) or `elevated` (Dialog) + `box-shadow: 0 16px 40px rgba(0,0,0,0.55)` | PromptCard, Dialogs ONLY |

No other shadows anywhere. Elevation on dark = lighter surface (Material dark-theme model), not shadow.

## 2.6 Motion standards

| Token | Value | Use |
|---|---|---|
| `micro` | 150ms ease-out | Hovers, color changes, partial→final text commit |
| `enter` | 200ms cubic-bezier(0.16, 1, 0.3, 1) | PromptCard slide-up (translateY 16px→0 + fade) |
| `exit` | 150ms ease-in | Dismissals (fade + translateY 0→8px) |
| `resolve` | 300ms ease | Gap-card resolved transition |
| `pulse` | 1.4s ease-in-out infinite | Recording dot (existing `pulse-red` — keep) |
| `count-up` | 800ms, requestAnimationFrame, ease-out cubic | Revenue number |
| Hard cap | 300ms | Any transition on the interaction path |

Mandatory global gate in `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Global focus style (replaces all `ring-primary/40`):

```css
:focus-visible {
  outline: 2px solid #60A5FA;  /* 7.42:1 vs background — passes SC 1.4.11 */
  outline-offset: 2px;
}
```

---

# 3. COMPONENT SPECS

## 3.1 Login page — `frontend/app/page.tsx`

Current structure is sound. Exact changes:
- Card: keep `max-w-md rounded-2xl border-border bg-surface p-10`; change `shadow-2xl shadow-black/40` → the overlay shadow token (`shadow-[0_16px_40px_rgba(0,0,0,0.55)]`).
- H1 "Speclyn": 36px/40px Inter 700 `foreground`, tracking -0.01em. Tagline: 14px `muted`, tracking 0.02em.
- Input: height 44px, `bg-background`, border `border-strong #6B7280` (control identification), radius 8px, placeholder `#9CA3AF` full opacity, focus per §2.6 (drop `focus:ring-2 ring-primary/40`).
- Submit button: `bg-[#2563EB]` (`primary-strong`), white, 14px/600, h-11, hover `#1D4ED8`, disabled opacity-50. Pending label "Signing in…" — keep.
- Error message: danger tokens — `border-danger/40 bg-danger/10 text-[#F87171]` (currently warning — B9).
- Add footer caption below card: `Demo environment · No real patient data` — 12px `#9CA3AF` (NOT `faint` — 12px must pass 4.5:1), centered, `mt-6`.

## 3.2 Dashboard layout — `frontend/app/dashboard/page.tsx`

- Header: exactly `h-14` (56px), `bg-surface border-b border-border px-6`; replace current `py-4`. Left: wordmark 20px/700 + hidden-on-mobile tagline 13px `muted`. Right: `StatusBadge` + Sign out.
- **StatusBadge** (new, inline in this file or extracted): pill `h-7 px-3 rounded-full border border-border bg-elevated text-[12px] font-medium`, contains 8px dot + label:
  - Ready: dot `#6B7280`, text `#9CA3AF` "Ready"
  - Recording: dot `#EF4444` with `animate-pulse-red`, text `#F87171` "Recording"
  - Analyzing: 12px spinner (`border-2 border-border border-t-primary rounded-full animate-spin`), text `#9CA3AF` "Analyzing"
  - Drive from existing state: `isAnalyzing` prop + a new `isRecording` boolean lifted from `EncounterPanel` via an `onStatusChange` callback.
- Grid: keep two-column `lg:flex-row`, Encounter `lg:w-[60%]`, Analysis `lg:w-[40%]`, `gap-6 p-6`. Below `lg` (1024px): stacked — Encounter first. This satisfies the guide's iPad-landscape requirement (1024–1366px viewports get two columns).
- Each panel scrolls internally: panels get `max-h-[calc(100vh-56px-48px)]` at `lg` so the page itself never scrolls on desktop.

## 3.3 EncounterPanel — `frontend/components/EncounterPanel.tsx`

Container: keep `rounded-xl border border-border bg-surface p-6 relative overflow-hidden`.

**Idle state** (note entry — current behavior, tuned):
- Panel title "Current Encounter" 18px/600.
- `Start Encounter` button: `bg-[#2563EB]` white 14px/600 h-10 px-5, with an 8px static dot `#F9FAFB/60` before the label (affordance for "this begins recording").
- Textarea: min-height 260px, `bg-background border border-strong rounded-lg p-5`, text 15px/1.7 `body`, placeholder full-opacity `#9CA3AF`. Placeholder copy (guide rule — real snippet): `Patient is a 68-year-old male with CHF, CKD, and Type 2 diabetes presenting for routine follow-up…`
- `Analyze Note` button: same primary-strong recipe, self-end.
- Error notice: danger tokens (as §3.1).

**Recording state:**
- Button swaps to `Stop Encounter`: `bg-[#DC2626]` (white = 4.83:1) hover `#B91C1C`, with 8px dot `#FCA5A5` pulsing (`animate-pulse-red`) — animate the dot only, not the button (guide rule — keep).
- **Session stat row** (new — replaces the guide's left rail): directly under the panel header, `flex gap-6`, each stat = label 11px UPPERCASE `muted` over value 15px/600 `foreground` `tabular-nums`:
  `DURATION 04:32 · GAPS FOUND 3 · PROMPTS 2`
  Duration from a 1s interval started at `startEncounter`; gaps/prompts counts from existing `seenPromptIdsRef` + merged analysis lengths (pass counts down from `dashboard/page.tsx` or track locally).
- Body: `LiveTranscript` (flex-1) + `VoiceRecorder` docked below — keep current arrangement.

**Finalizing state:** Stop button disabled, label "Finalizing…", keep 12s timeout fallback. StatusBadge shows "Analyzing".

**Prompt queue behavior** (owner of the queue — keep):
- Max one `PromptCard` mounted (keep `promptQueue[0]`).
- If `promptQueue.length > 1`, render under the card: `+{n−1} more question{s}` — 12px `#9CA3AF`, right-aligned inside the card footer (passes 4.5:1; do not use `faint`).
- New callback `onCollapse` from PromptCard (§3.5): move the active prompt to a `parkedPrompts` list and render the **queue chip** in the transcript header area: `rounded-full border border-warning/40 bg-warning/10 px-3 h-7 text-[12px] text-[#FBBF24]` with text `{n} clarification{s} waiting`; clicking it re-activates the first parked prompt.

## 3.4 LiveTranscript — `frontend/components/LiveTranscript.tsx`

The streaming contract (AssemblyAI Universal-Streaming, Phase 4): partial segments arrive fast and are **immutable**; a finalized, formatted turn commits later. Render partials immediately; commit finals — never reflow committed text.

**Props change:** `transcript: string` → `{ finalText: string; partialText: string }` (EncounterPanel passes `partialText: ""` for the typed fallback, which is always final).

**Header row** (new, above the scroll area): left = section label `TRANSCRIPT` (11px UPPERCASE `muted`); right, only while recording = LIVE cluster: 8px dot `#EF4444` `animate-pulse-red` + `LIVE` 11px/600 tracking-widest `#F87171` + timer `04:32` 12px `#9CA3AF` `tabular-nums`.

**Text treatment:**
- Final text: 15px/1.7 Inter 400, color `#E5E7EB` (15.24:1), `tracking-[0.01em]`, `whitespace-pre-wrap`.
- Partial text: same metrics, color `#9CA3AF` (7.43:1 — still AA), no italics (italics degrade readability for dyslexic readers). On finalization the segment's color transitions `#9CA3AF → #E5E7EB` over 150ms ease-out. This dimmed-partial/full-final pattern is the standard live-caption treatment (display partials for immediacy, persist finals for the record).
- Cursor: keep the 2px × 20px `bg-primary` `animate-blink` block after the partial text.
- Container: `bg-background border border-border rounded-lg p-5` (decorative border fine — the region is identified by content, not border).

**Scroll behavior (fixes B6):**
- Track `isPinned = scrollHeight − scrollTop − clientHeight < 40` on scroll events. Auto-scroll on new text only when pinned.
- When not pinned and new text arrives: show a centered bottom-floating pill `Jump to live ↓` — `bg-elevated border border-border rounded-full h-8 px-4 text-[12px] font-medium text-[#60A5FA]`, click scrolls to bottom and re-pins. Enter 150ms fade.

**Accessibility (fixes B7):** container `role="log"` + `aria-live="polite"` on a wrapper that contains ONLY finalized segments (append-only nodes); the partial span sits outside it with `aria-hidden="true"`. Screen readers hear each sentence once, when final.

**Empty (listening) state:** keep current copy, color `muted`.

## 3.5 PromptCard — `frontend/components/PromptCard.tsx` (the moment of the product)

**Design rationale:** keep the light-card-on-dark polarity inversion. On an otherwise uniformly dark screen it is the highest-salience signal available without motion or sound — attention is bought with luminance, not interruption. It also photographs well in demos. The guide's dark `bg-elevated` card with amber border is strictly less salient; rejected.

**Anatomy (top→bottom):**
1. Label row: inline SVG chat icon 16×16 stroke `#1D4ED8` (replaces 💬 — B8) + `Quick clarification` 13px/600 `#1D4ED8` (6.70:1). Right side: nothing (no countdown, no close ×; Skip is the escape hatch).
2. Question: 17px/1.5 Inter 600 `#111827` (17.74:1). One question. Never two.
3. Optional context line (when the API provides `why`): 13px/1.5 `#374151` (10.31:1), e.g. "Affects reimbursement classification." Max one line, truncate with ellipsis.
4. Button row, `gap-3`, 16px above:
   - `Answer verbally` — filled `bg-[#2563EB]` white 14px/600 h-10 px-5 rounded-lg, hover `#1D4ED8`. (White-on-`#059669` was considered for the guide's green treatment and fails at 3.77:1; a compliant green fill `#047857` (5.48:1) is approved as an alternative if the founder insists on green — pick ONE, default blue.)
   - `Skip` — ghost: text `#4B5563` 14px/500, h-10 px-4, hover `bg-[#E5E7EB] text-[#111827]`.
   - If queue > 1: right-aligned `+{n} more` 12px `#6B7280` on white = 4.83:1 — passes.
5. Card: `bg-white rounded-xl border-l-4 border-[#2563EB] p-5 max-w-xl w-full`, overlay shadow token. Positioned as now: absolute inset-x-0 bottom-0 of the encounter panel, centered, `px-4 pb-4`, `z-20`.

**Behavior:**
- Enter: 200ms `cubic-bezier(0.16,1,0.3,1)`, translateY 16px→0 + opacity 0→1 (keep the rAF-mount pattern; change duration from 300→200 enter / 150 exit).
- **Auto-collapse, not auto-dismiss (C3):** after 45,000ms without interaction, play exit animation and call new `onCollapse()` — the prompt parks in the queue chip (§3.3). It is never silently lost.
- Keyboard: `Enter` → Answer verbally, `Escape` → Skip. Add a `useEffect` keydown listener scoped to card mount.
- Semantics: keep `role="alertdialog"`; add `aria-labelledby` pointing at the question element; move focus to the card container (`tabIndex={-1}`) on mount, return focus to the panel on exit.
- One card at a time (keep). Left border color stays constant `#2563EB` — the prompt is a colleague's question, not a warning; amber is reserved for the gap cards (this also implements principle #3).

**5-second test (guide's own bar):** label states who's asking, question is the largest text, two verbs, zero chrome. Passes.

## 3.6 AnalysisPanel + RevenueImpact — `frontend/components/AnalysisPanel.tsx`, `frontend/components/RevenueImpact.tsx`

**Revenue block (first element, always):**
- Label `ESTIMATED REVENUE IMPACT` — 11px UPPERCASE tracking 0.08em `muted`.
- Number: 36px/40px (xl: 44px) Inter 700, `tabular-nums`, color `#34D399` (9.82:1; replaces `#10B981` text and the guide's neon `#10F28A`). Format `$1,800 – $3,300` with the en-dash in `muted`.
- Count-up: on first mount of a new `total_range`, animate both bounds 0→value over 800ms via requestAnimationFrame with ease-out cubic (`1 − (1−t)³`). Skip entirely when `matchMedia('(prefers-reduced-motion: reduce)')` matches — render final value immediately.
- Subline `per patient, annualized` — 13px `muted`. Keep per-item rows; item dollar values `#34D399` 13px/600 `tabular-nums`; `basis` line 12px JetBrains Mono `muted`. Assumptions block: 12px `muted` — keep.

**Section headers:** 13px/600 UPPERCASE tracking 0.05em `muted` + count badge: warning sections `bg-warning/10 text-[#FBBF24]` (10.07:1), success/HCC `bg-success/10 text-[#34D399]` (8.75:1) — replaces current `/15` tints with `/10`.

**Gap card:** `bg-background border border-border border-l-[3px] border-l-warning rounded-lg p-4`. Condition 15px/600 `foreground`; "Missing:" prefix `muted` + value 14px `body`; ICD chips: JetBrains Mono 12px/500 `#60A5FA` (6.61:1 on surface — replaces `text-primary` at 4.57:1) on `bg-surface border border-border rounded-md px-2 py-0.5`; why-line 12px `muted`.

**HCC card:** same recipe with `border-l-[3px] border-l-info` (adopts the guide's info-blue = HCC convention). Status pill: captured/documented → `bg-success/10 text-[#34D399] border-success/40`; else `bg-warning/10 text-[#FBBF24] border-warning/40`.

**Resolved gap state** (when a prompt tied to a gap is answered): `border-l-success`, 16px check SVG `#34D399` before the condition name, card `opacity-60`, NO strikethrough (strikethrough on clinical text reads as "wrong", and low-contrast struck text is illegible — overrides the guide), transition 300ms ease.

**Loading state:** replace the spinner `EmptyState` branch with skeletons mirroring content shape: one 40px-tall bar (radius 8px) + two 12px bars at 60%/40% width + two 72px card blocks — `bg-elevated rounded animate-[skeleton-pulse_1.5s_ease-in-out_infinite]` with keyframes `0%,100% {opacity:.4} 50% {opacity:.8}` added to `tailwind.config.ts`.

**Empty state:** keep current copy/dashed border. **Export button:** keep; hover fill uses `primary-strong #2563EB` so hovered white text passes (5.17:1).

## 3.7 VoiceRecorder — `frontend/components/VoiceRecorder.tsx`

- Container: keep `bg-background border border-border rounded-lg p-4`.
- Recording cluster: 10px dot `#EF4444` `animate-pulse-red` (keep) + `Recording` 13px/500 `#F87171` (6.08:1 — replaces `text-red-400`… identical hex, now tokenized) + elapsed `mm:ss` 12px `#9CA3AF` `tabular-nums` (new — mirrors the session timer).
- Waveform: keep 7 CSS bars; width 5px (`w-[5px]`), color `#60A5FA/80`; add `motion-reduce:animate-none` and render bars at static 40% height under reduced motion. Decorative → `aria-hidden` (already set — keep).
- Phase-note text ("Audio captured locally…"): 12px `#9CA3AF` — keep content until Phase 4 wiring, then replace with connection state: `Connected · AssemblyAI` / `Reconnecting…` in same style.
- Denied state: keep copy; color `muted`. Requesting state: keep.
- Typed fallback: input `border-strong`, placeholder full opacity; `Send` button → outlined style, text `#60A5FA` border `primary/60`, hover fill `#2563EB` + white.

---

# 4. PRIORITIZED IMPLEMENTATION CHECKLIST

Execute in order. All paths relative to repo root `D:\AI Saas Product\Speclyn-Demo\`.

## P0 — Accessibility & correctness (ship before any demo)

1. **`frontend/tailwind.config.ts`** — extend colors: `elevated: "#232734"`, `"border-strong": "#6B7280"`, `body: "#E5E7EB"`, `faint: "#6B7280"`, `"primary-strong": "#2563EB"`, `"primary-bright": "#60A5FA"`, `"success-bright": "#34D399"`, `"warning-bright": "#FBBF24"`, `danger: "#EF4444"`, `"danger-bright": "#F87171"`, `"danger-strong": "#DC2626"`, `info: "#38BDF8"`. Add `skeleton-pulse` keyframes/animation (§3.6).
2. **`frontend/app/globals.css`** — add `prefers-reduced-motion` global gate and `:focus-visible` outline block (§2.6). Change body color to `#E5E7EB`.
3. **Filled-button fix (B1)** — replace `bg-primary` with `bg-primary-strong` (hover `#1D4ED8`) on: submit in `frontend/app/page.tsx`; Start Encounter + Analyze Note in `frontend/components/EncounterPanel.tsx`; Answer verbally in `frontend/components/PromptCard.tsx`. Remove all `focus:ring-primary/40|30` (global focus-visible now handles it).
4. **Placeholder fix (B2)** — `placeholder-muted/60` → `placeholder-muted` in `frontend/app/page.tsx`, `frontend/components/EncounterPanel.tsx`, `frontend/components/VoiceRecorder.tsx`.
5. **`frontend/components/PromptCard.tsx`** — 💬 → inline SVG chat icon `#1D4ED8` (B8); label color → `#1D4ED8` (B3); skip text → `#4B5563` w/ hover `bg-[#E5E7EB] text-[#111827]` (B4); card `bg-gray-50` → `bg-white` + `border-l-4 border-[#2563EB]`.
6. **`frontend/app/page.tsx`** — login error → danger tokens (B9); footer caption per §3.1.

## P1 — Core experience

7. **`frontend/components/LiveTranscript.tsx`** — props `{finalText, partialText}`; partial `#9CA3AF` → final `#E5E7EB` 150ms commit; header row w/ LIVE cluster + timer; pinned-scroll + "Jump to live" pill; `role="log"` restructure (§3.4). Update the call site in `EncounterPanel.tsx`.
8. **`frontend/components/PromptCard.tsx`** — 30s auto-dismiss → 45s auto-collapse w/ `onCollapse` prop; Enter/Escape keys; enter 200ms / exit 150ms; focus management (§3.5).
9. **`frontend/components/EncounterPanel.tsx`** — session stat row (duration/gaps/prompts, §3.3); parked-prompt queue chip; "+N more" indicator; Stop button `bg-danger-strong` + pulsing dot; textarea/input borders → `border-strong`; expose `onStatusChange` for StatusBadge.
10. **`frontend/app/dashboard/page.tsx`** — header to `h-14`; add StatusBadge (§3.2); panel max-height for independent scrolling.
11. **`frontend/components/RevenueImpact.tsx`** — number → 36/44px Inter 700 `tabular-nums` `#34D399`; 800ms count-up with reduced-motion skip; item values `#34D399`; basis lines JetBrains Mono 12px.
12. **`frontend/components/AnalysisPanel.tsx`** — skeleton loading state (§3.6); ICD chips `#60A5FA`; HCC `border-l-info`; count badges to `/10` tints + bright text; resolved-gap state; export hover `primary-strong`.

## P2 — Polish

13. **`frontend/app/layout.tsx`** (or equivalent) — load Inter + JetBrains Mono via `next/font/google`; optional DM Serif Display for the wordmark in `page.tsx` + `dashboard/page.tsx` headers only.
14. **`frontend/components/VoiceRecorder.tsx`** — elapsed timer; waveform width/color/reduced-motion tweaks; outlined Send button (§3.7).
15. **`frontend/app/globals.css`** — scrollbar thumb hover already `#4A5568`; align to `#4B5563` token; verify print stylesheet still targets `#analysis-print` after AnalysisPanel edits.
16. Tablet pass: verify 1024×768 and 1366×1024 (iPad landscape) render two columns with no horizontal scroll; stacked order below 1024px = Encounter → Analysis.

---

# 5. REFERENCES

**Ambient clinical AI / in-workflow decision support**
- Abridge — Bringing Clinical Decision Support Into the Flow of Clinical Conversations: https://www.abridge.com/blog/clinical-decision-support
- Abridge platform (clinician workflow: "talk to the patient, sign the note"): https://www.abridge.com/platform/clinicians
- Contrary Research — Abridge business breakdown: https://research.contrary.com/company/abridge
- Nuance DAX Copilot overview: https://www.startstop.com/nuance-dax-copilot/
- DAX Copilot vs Suki comparison (2026): https://aibusiness.vc/tools/compare/nuance-dax-vs-suki-ai
- Epic + Dragon Copilot integration into Hyperdrive/Haiku/Canto (Microsoft Ignite 2025): https://optimumhit.com/insights/blog/cloud-services/epic-embraces-ai-key-highlights-from-microsoft-ignite-2025/

**Alert fatigue / physician cognitive load**
- Ancker et al., "Effects of workload, work complexity, and repeated alerts on alert fatigue in a clinical decision support system" (≈30% acceptance drop per additional reminder per encounter): https://pubmed.ncbi.nlm.nih.gov/28395667/ · full text: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5387195/
- "Clinical Decision Support Stewardship: Best Practices and Techniques to Monitor and Improve Interruptive Alerts": https://pmc.ncbi.nlm.nih.gov/articles/PMC9132737/
- Alert fatigue measurement in CDS — systematic review (2026): https://www.metrohealth.org/globalassets/metrohealth-documents/population-health-research-institute/ray-wilson-et-al-2026-alert-fatigue-systematic-review.pdf
- Replacing a burdensome interruptive alert with passive CDS: https://www.researchgate.net/publication/376459605_Addressing_Alert_Fatigue_by_Replacing_a_Burdensome_Interruptive_Alert_with_Passive_Clinical_Decision_Support

**Dark-theme accessibility & contrast**
- WCAG 2.1 Understanding SC 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- WCAG 2.1 Understanding SC 1.4.11 Non-text Contrast: https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html
- Material Design — Dark theme (surface #121212, 15.8:1 guidance, desaturated palettes, elevation-by-lightening): https://m2.material.io/design/color/dark-theme.html · companion codelab: https://codelabs.developers.google.com/codelabs/design-material-darktheme
- NN/g — Dark Mode vs. Light Mode: https://www.nngroup.com/articles/dark-mode/
- DubBot — Dark Mode: Best Practices for Accessibility (halation/astigmatism): https://dubbot.com/dubblog/2023/dark-mode-a11y.html
- The Designer's Guide to Dark Mode Accessibility: https://www.accessibilitychecker.org/blog/dark-mode-accessibility/
- Complete accessibility guide for dark mode & high contrast (WCAG 2.1 AA): https://blog.greeden.me/en/2026/02/23/complete-accessibility-guide-for-dark-mode-and-high-contrast-color-design-contrast-validation-respecting-os-settings-icons-images-and-focus-visibility-wcag-2-1-aa/
- GitHub Primer — Color considerations: https://primer.style/accessibility/design-guidance/color-considerations/
- MDN — prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

**Realtime transcription / live-caption UX**
- AssemblyAI — Universal Streaming (immutable transcripts; render partials, commit finals): https://www.assemblyai.com/docs/streaming/universal-streaming
- AssemblyAI — Partial transcripts & turn detection: https://www.assemblyai.com/docs/streaming/universal-3-pro/turn-detection-and-partials
- AssemblyAI — Streaming message sequence: https://www.assemblyai.com/docs/streaming/universal-3-pro/u3-pro-message-sequence
- Smashing Magazine — Closed Captions and Subtitles UX: https://www.smashingmagazine.com/2023/01/closed-captions-subtitles-ux/
- AssemblyAI — Top tools for live transcription: https://www.assemblyai.com/blog/top-tools-for-live-transcription

---
*Speclyn Design Specification v1.0 — 2026-08 · All contrast ratios computed via WCAG 2.x relative luminance; unrounded values compared against 4.5:1 / 3:1 thresholds.*
