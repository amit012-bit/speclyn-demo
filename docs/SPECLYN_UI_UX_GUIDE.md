# Speclyn — UI/UX Design Guide
## Claude Code Frontend Instruction File
## Read completely before writing a single component.

---

## DESIGN PHILOSOPHY

Speclyn is used by physicians during or immediately after a clinical
encounter. The person looking at this screen is cognitively loaded,
time-pressured, and highly skeptical of AI tools that feel generic
or untrustworthy.

Three principles govern every design decision:

1. TRUST OVER FLASH
   The interface must feel like a precision clinical tool, not a
   startup product. Every element earns its place. Nothing decorative
   that doesn't carry information. No animations that don't communicate
   state. No gradients that don't mean something.

2. ZERO COGNITIVE LOAD
   A physician using Speclyn during an encounter cannot afford to
   think about the interface. Every interaction must be obvious on
   first contact. If a physician has to read a label twice, the
   design failed.

3. THE AI IS A COLLEAGUE, NOT A COMPLIANCE TOOL
   Every prompt, every label, every piece of copy in this product
   must feel like it came from an intelligent medical colleague —
   not a billing department audit system. This distinction is what
   determines physician adoption or rejection.

---

## VISUAL IDENTITY

### Typography

Use these exact font pairings via Google Fonts:

```css
/* Display / Logo */
font-family: 'DM Serif Display', serif;
/* Use for: Speclyn logo, large headings, revenue numbers */

/* UI Text */
font-family: 'Inter', sans-serif;
/* Use for: all body text, labels, buttons, inputs */

/* Clinical / Transcript */
font-family: 'JetBrains Mono', monospace;
/* Use for: live transcript text, ICD codes, clinical data */
```

Import in globals.css:
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

### Color System

Define these as CSS variables in globals.css and use ONLY these values.
Never use hardcoded hex values in components:

```css
:root {
  /* Backgrounds */
  --bg-base: #0C0E14;          /* Page background — deep navy black */
  --bg-surface: #13161F;       /* Cards, panels */
  --bg-elevated: #1A1E2A;      /* Hover states, dropdowns */
  --bg-overlay: #222736;       /* Modals, tooltips */

  /* Borders */
  --border-subtle: #1E2333;    /* Dividers, card borders */
  --border-default: #2A3045;   /* Input borders, separators */
  --border-emphasis: #3D4663;  /* Active states, focused inputs */

  /* Brand */
  --brand-primary: #4F7EF7;    /* Primary actions, links */
  --brand-primary-hover: #3D6EE8;
  --brand-glow: rgba(79,126,247,0.15); /* Subtle glow on active elements */

  /* Semantic */
  --success: #22C55E;          /* Revenue numbers, resolved gaps */
  --success-bg: rgba(34,197,94,0.08);
  --warning: #F59E0B;          /* Active gaps, unresolved prompts */
  --warning-bg: rgba(245,158,11,0.08);
  --error: #EF4444;            /* Critical gaps, errors */
  --error-bg: rgba(239,68,68,0.08);
  --info: #38BDF8;             /* HCC opportunities */
  --info-bg: rgba(56,189,248,0.08);

  /* Text */
  --text-primary: #F0F2F7;     /* Main content */
  --text-secondary: #8B92A8;   /* Labels, metadata */
  --text-tertiary: #4A5169;    /* Placeholders, disabled */
  --text-inverse: #0C0E14;     /* Text on light backgrounds */

  /* Revenue — special treatment */
  --revenue-green: #10F28A;    /* The big dollar number */
  --revenue-green-dim: rgba(16,242,138,0.6);

  /* Live recording */
  --live-red: #FF3B3B;
  --live-pulse: rgba(255,59,59,0.3);
}
```

### Spacing Scale

Use Tailwind's default spacing scale. Do not create custom spacing.
Key values to use consistently:
- Component padding: p-4 (16px) or p-6 (24px)
- Section gaps: gap-4 or gap-6
- Card border radius: rounded-xl (12px) for cards, rounded-lg (8px) for inputs

---

## PAGE ARCHITECTURE

### Login Page

Full-screen centered layout. Dark background.

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│         SPECLYN                             │
│         Clinical documentation intelligence │
│                                             │
│    ┌─────────────────────────────────────┐  │
│    │  Access code                        │  │
│    │  [••••••••••••]                     │  │
│    │                                     │  │
│    │  [    Enter Speclyn    ]             │  │
│    └─────────────────────────────────────┘  │
│                                             │
│    Demo environment · No real patient data  │
│                                             │
└─────────────────────────────────────────────┘
```

Design details:
- Logo: "SPECLYN" in DM Serif Display, 48px, text-primary
- Tagline: Inter 300, 14px, text-secondary, letter-spacing wide
- Card: bg-surface, border border-subtle, rounded-2xl, p-8
- Input: bg-overlay, border-default, rounded-lg, focus:border-brand-primary
- Button: bg-brand-primary, full width, rounded-lg, Inter 500 14px
- Footer text: text-tertiary, 12px
- No logo images, no decorative elements, no background patterns

---

### Dashboard Layout

Three-column layout on desktop. Single column on mobile (stacked).

```
┌──────────────────────────────────────────────────────────────────┐
│  SPECLYN                              [End Encounter]  [Export]  │  ← Header: 56px
├──────────────────────────────────────────────────────────────────┤
│                    │                        │                    │
│   ENCOUNTER        │   LIVE TRANSCRIPT      │   ANALYSIS         │
│   CONTROLS         │   + PROMPTS            │   PANEL            │
│   (20%)           │   (50%)                │   (30%)            │
│                    │                        │                    │
│                    │                        │                    │
└──────────────────────────────────────────────────────────────────┘
```

On tablet (768px-1024px): Two columns — controls collapse into header,
transcript takes 60%, analysis takes 40%.

On mobile (<768px): Single column, stacked vertically.

---

## COMPONENT SPECIFICATIONS

### Header

```tsx
// Height: 56px
// Background: bg-surface
// Border bottom: border-subtle
// No box shadow — clean flat separation

<header className="h-14 bg-surface border-b border-subtle flex items-center justify-between px-6">
  <span className="font-serif text-xl text-primary tracking-tight">
    Speclyn
  </span>
  <div className="flex items-center gap-3">
    <StatusBadge />     {/* Shows: Ready / Recording / Analyzing */}
    <ExportButton />
    <EndButton />
  </div>
</header>
```

StatusBadge states:
- Ready: dot in text-tertiary + "Ready"
- Recording: pulsing red dot + "Recording" in live-red
- Analyzing: spinning indicator + "Analyzing"

---

### Left Panel — Encounter Controls

```
┌──────────────────────────┐
│  Encounter               │
│  ─────────────────────── │
│                          │
│  [  ● Start Encounter  ] │  ← Primary button, full width
│                          │
│  ─────────────────────── │
│                          │
│  Or paste a note         │
│                          │
│  ┌────────────────────┐  │
│  │                    │  │
│  │  Clinical note...  │  │  ← Textarea, 200px min height
│  │                    │  │
│  └────────────────────┘  │
│                          │
│  [  Analyze Note  ]      │  ← Secondary button
│                          │
│  ─────────────────────── │
│                          │
│  Session                 │
│  Duration: 0:00          │
│  Gaps found: 0           │
│  Prompts shown: 0        │
│                          │
└──────────────────────────┘
```

Start Encounter button when recording:
- Changes to "● Stop Encounter" with live-red background
- Pulsing animation on the dot only (not the whole button)

Session stats update in real time as the encounter progresses.

---

### Center Panel — Live Transcript

This is the most important panel. The physician watches their words
appear here in real time. Design it like a clinical document editor.

```
┌────────────────────────────────────────────────┐
│  Live Transcript          🔴 LIVE  0:45        │
│  ──────────────────────────────────────────── │
│                                                │
│  Patient is a 68-year-old male presenting      │
│  with a history of congestive heart failure    │
│  and chronic kidney disease. The patient       │
│  reports feeling slightly better than last     │
│  visit. Blood pressure is well controlled      │
│  on current medications...                     │
│                                                │
│  ▌                                             │  ← Blinking cursor
│                                                │
│  ──────────────────────────────────────────── │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  💬  Was the CHF systolic or diastolic?  │ │  ← PromptCard
│  │                                          │ │
│  │  [Answer verbally]      [Skip]           │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

Transcript text styling:
- Font: JetBrains Mono, 14px, text-primary
- Line height: 1.8
- Letter spacing: 0.01em
- New words fade in: opacity-0 to opacity-100 over 150ms
- Smooth scroll to bottom as new words appear
- Padding: p-6
- Background: bg-base (slightly darker than panels)

LIVE indicator:
- Red dot (live-red) with CSS pulse animation
- "LIVE" text in live-red, Inter 600, 11px, letter-spacing widest
- Timer counting up: "0:45"
- Only visible when recording is active

---

### PromptCard — Most Critical Component

This card appears at the bottom of the transcript panel when Speclyn
detects a gap. It is the moment of the product. Design it so a
physician instantly understands what's being asked and wants to answer.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ╔═══════════════════════════════════════════════╗  │
│  ║  💬  Speclyn                        [×]      ║  │
│  ║  ─────────────────────────────────────────── ║  │
│  ║                                               ║  │
│  ║  Was the patient's CHF systolic               ║  │
│  ║  or diastolic?                                ║  │
│  ║                                               ║  │
│  ║  This affects reimbursement classification.   ║  │
│  ║                                               ║  │
│  ║  [  ✓ Answer verbally  ]   [ Skip for now ]  ║  │
│  ╚═══════════════════════════════════════════════╝  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

PromptCard CSS details:
- Background: bg-elevated
- Left border: 3px solid var(--warning)
- Border radius: rounded-xl
- Padding: p-5
- Slide-up animation: translateY(20px) opacity-0 → translateY(0) opacity-100
  Duration: 200ms ease-out
- Auto-dismiss after 30 seconds (show countdown in corner)

"Speclyn" label: text-warning, Inter 600, 12px
Question text: text-primary, Inter 500, 16px, line-height 1.5
Sub-text: text-secondary, Inter 400, 13px

"Answer verbally" button:
- Background: success-bg
- Border: 1px solid success
- Text: success, Inter 600, 13px
- Hover: slightly brighter border

"Skip for now" button:
- Background: transparent
- Border: border-default
- Text: text-secondary
- Hover: text-primary

Maximum one PromptCard visible at a time.
Queue additional prompts — they appear after the current one is resolved.
Show prompt count in header if queue length > 1: "2 more questions"

---

### Right Panel — Analysis

```
┌─────────────────────────────┐
│  Revenue Impact             │
│                             │
│  $1,800 — $3,300           │  ← Large, revenue-green
│  per patient per year       │
│                             │
│  ─────────────────────────  │
│                             │
│  Specificity Gaps    (3)    │
│                             │
│  ┌───────────────────────┐  │
│  │ ⚠ CHF                │  │
│  │ Systolic vs diastolic │  │
│  │ not specified         │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ⚠ CKD                │  │
│  │ Stage 3a vs 3b        │  │
│  │ not specified         │  │
│  └───────────────────────┘  │
│                             │
│  HCC Opportunities   (2)    │
│                             │
│  ┌───────────────────────┐  │
│  │ ℹ Diabetes            │  │
│  │ Complications not     │  │
│  │ addressed this visit  │  │
│  └───────────────────────┘  │
│                             │
│  Clarification Questions(3) │
│                             │
│  1. Was the CHF...          │
│  2. What stage is...        │
│  3. Were diabetic...        │
│                             │
└─────────────────────────────┘
```

Revenue number styling:
```css
.revenue-number {
  font-family: 'DM Serif Display', serif;
  font-size: 2.5rem;
  color: var(--revenue-green);
  letter-spacing: -0.02em;
  line-height: 1;
}
```

Gap cards:
- bg-warning-bg, border border-warning/30, rounded-lg, p-3
- Icon: ⚠ in warning color
- Condition name: Inter 600, 13px, text-primary
- Description: Inter 400, 12px, text-secondary

HCC cards:
- bg-info-bg, border border-info/30
- Icon: ℹ in info color

Resolved gaps (when physician answers the prompt):
- bg-surface, border border-success/30
- Icon changes to ✓ in success color
- Text gets strikethrough + text-tertiary
- Smooth transition: 300ms

---

## MICRO-INTERACTIONS — BUILD ALL OF THESE

These are what separate a product from a prototype.

**1. Recording pulse**
When recording is active, the "● Stop Encounter" button dot pulses:
```css
@keyframes pulse-record {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
.recording-dot { animation: pulse-record 1.5s ease-in-out infinite; }
```

**2. New transcript word fade-in**
Each new word appears with:
```css
@keyframes word-appear {
  from { opacity: 0; }
  to { opacity: 1; }
}
.new-word { animation: word-appear 150ms ease-out; }
```

**3. PromptCard slide-up**
```css
@keyframes prompt-slide-up {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.prompt-card { animation: prompt-slide-up 200ms ease-out; }
```

**4. Gap card resolve**
When a gap is resolved, the card transitions:
```css
.gap-card { transition: all 300ms ease; }
.gap-card.resolved {
  opacity: 0.5;
  border-color: var(--success);
}
```

**5. Revenue number count-up**
When the analysis result arrives, the revenue number counts up from 0
to the actual value over 800ms using a counter animation.
Use a simple requestAnimationFrame counter, not a library.

**6. Analysis panel skeleton loading**
While waiting for analysis, show pulsing placeholder bars:
```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
.skeleton-bar {
  background: var(--bg-elevated);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```

---

## EMPTY AND LOADING STATES

Every state must be handled. Never show a blank panel.

**Before any encounter starts:**
Center panel shows:
```
[Microphone icon, large, text-tertiary]
Start recording to see your encounter transcript here,
or paste a clinical note below.
```

Right panel shows:
```
[Chart icon, large, text-tertiary]
Analysis will appear here once
an encounter is started or a note is pasted.
```

**While analyzing (loading state):**
Right panel shows skeleton bars in the shape of the content.
Center panel shows "Analyzing documentation..." with a subtle spinner.

**No gaps found (well-documented note):**
Right panel shows:
```
[Checkmark icon in success color]
This note is well documented.
No specificity gaps detected.

Revenue impact: Minimal
```

---

## TYPOGRAPHY SCALE

Use these exact sizes. Do not create new sizes:

```
Display (revenue number): 2.5rem / DM Serif Display
H1 (page titles): 1.5rem / Inter 700
H2 (section headers): 1rem / Inter 600, letter-spacing: 0.05em, uppercase
H3 (card titles): 0.875rem / Inter 600
Body (primary): 0.875rem / Inter 400
Body small: 0.8125rem / Inter 400
Caption: 0.75rem / Inter 400
Label: 0.6875rem / Inter 600, letter-spacing: 0.08em, uppercase
Code/Clinical: 0.875rem / JetBrains Mono 400
```

Section headers (H2) always displayed in uppercase with wide letter
spacing — this creates the clinical/precision feel:
```
SPECIFICITY GAPS    not    Specificity Gaps
```

---

## SHADCN/UI COMPONENTS TO USE

Initialize shadcn in the Next.js project and use these specific
components. Do not build custom versions of things shadcn already has:

- Badge — for gap severity labels
- Button — all buttons (use variants: default, outline, ghost)
- Card — all panel cards
- Dialog — for export confirmation
- Separator — panel dividers
- Skeleton — loading states
- Textarea — note input
- Tooltip — for ICD code explanations
- ScrollArea — for transcript and analysis panels

Install:
```bash
npx shadcn@latest init
npx shadcn@latest add button card badge dialog separator skeleton textarea tooltip scroll-area
```

---

## EXPORT PDF FEATURE

When "Export" is clicked, generate a clean PDF of the analysis.
Use the browser's native print API — no library needed.

Create a hidden printable div with this structure:
```
Speclyn Analysis Report
Generated: [timestamp]
────────────────────────
REVENUE IMPACT: $X,XXX — $X,XXX per patient per year
────────────────────────
SPECIFICITY GAPS
1. CHF — Systolic vs diastolic not specified
   Possible codes: I50.20 (unspecified) → I50.21 (systolic) → I50.22 (diastolic)
...
────────────────────────
HCC OPPORTUNITIES
...
────────────────────────
CLARIFICATION QUESTIONS
1. Was the CHF systolic or diastolic?
...
────────────────────────
Disclaimer: Revenue estimates based on published CMS/HCC benchmarks.
```

CSS for print:
```css
@media print {
  body * { visibility: hidden; }
  #print-report, #print-report * { visibility: visible; }
  #print-report { position: absolute; left: 0; top: 0; width: 100%; }
}
```

---

## RESPONSIVENESS

Three breakpoints, all must work:

**Desktop (>1280px):** Three-column layout as described above
**Tablet (768px-1280px):** Two-column — controls in header, transcript + analysis split
**Mobile (<768px):** Single column, tabbed navigation between panels

The product will be used on:
- Desktop workstations (most common for text analysis)
- iPad/tablets (most common for live encounter recording)
- This is why tablet layout is critical, not optional

---

## WHAT GOOD LOOKS LIKE

When you finish the frontend, open it and ask yourself:

1. Does it look like something Epic or Abridge would be proud to show
   a health system CIO? If yes, continue. If no, find what's wrong.

2. Does every element have a reason to exist? Remove anything that
   doesn't carry information or enable an action.

3. Would a physician in the middle of a patient encounter be able to
   understand and respond to a PromptCard in under 5 seconds without
   reading any instructions? If no, simplify the card.

4. Does the revenue number hit you immediately when you look at the
   analysis panel? It should be the first thing your eye goes to.

5. Does the live transcript feel like watching a clinical document
   write itself in real time? The monospace font and word-by-word
   appearance should create that feeling.

---

## DO NOT

- Do not use gradients on interactive elements
- Do not use more than 3 font weights in any single component
- Do not use box shadows — use borders instead
- Do not animate anything that takes longer than 300ms
- Do not use emoji in the production UI (only in development notes)
- Do not use placeholder text that says "Enter your clinical note here..."
  — use a real example snippet so it looks like a real product on first load
- Do not show raw JSON anywhere in the UI under any circumstances
- Do not use loading spinners that block the whole screen
- Do not use alert() or confirm() — use Dialog components instead

---

## PLACEHOLDER CONTENT FOR FIRST LOAD

Make the product look real from the first second. Pre-populate:

Transcript placeholder (shown in text area mode):
```
Patient is a 68-year-old male with CHF, CKD, and Type 2 diabetes
presenting for routine follow-up. Blood pressure 128/78, well
controlled. Patient reports mild fatigue but no acute symptoms.
Continue current medication regimen. Follow up in 3 months.
```

This placeholder is replaced the moment the user starts typing
or starts a recording.

---

## FINAL CHECKLIST BEFORE CONSIDERING UI COMPLETE

Before calling the frontend done, verify every item:

[ ] Login page looks polished on desktop and mobile
[ ] Dashboard loads in under 2 seconds
[ ] Start Encounter button triggers mic permission request
[ ] Recording indicator shows when mic is active
[ ] Transcript appears word-by-word in real time
[ ] PromptCard slides up smoothly when a gap is detected
[ ] Only one PromptCard visible at a time
[ ] Revenue number counts up with animation
[ ] Gap cards transition smoothly when resolved
[ ] Analysis panel shows skeleton while loading
[ ] Empty states show for all panels
[ ] Export creates a clean readable PDF
[ ] Text analysis mode works without microphone
[ ] All panels scroll independently without affecting each other
[ ] Works correctly on an iPad in landscape mode
[ ] No raw JSON visible anywhere under any circumstance
[ ] No console errors in browser developer tools
[ ] Password protection works — /dashboard redirects to / if no JWT

---

*Speclyn — UI/UX Design Guide*
*Standard: Enterprise clinical product, investor-ready*
*Every component must meet this bar before shipping*
*Founder: Amit Prakhar Pandey*
