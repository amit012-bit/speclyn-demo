# Speclyn — Add Real-Time Encounter Preview
## Claude Code Instruction File
## Read completely before writing any code.

---

## CONTEXT

This is an addition to the existing Speclyn Documentation Gap Analyzer demo
(app.py, analyzer.py, sample_notes.py). The core demo already works — it takes
a clinical note as input and returns structured analysis of ICD-10 specificity
gaps, HCC opportunities, clarification questions, and revenue impact.

We are adding one new section at the bottom of the results page called
"What This Looks Like in Real Time" — a visual simulation that shows how
Speclyn would behave during an actual clinical encounter, while the doctor
is still talking.

This section is NOT functional — it is a UI mockup / story-telling component.
Its job is to help a potential customer visualize the end product, not just
the current demo. When they see the analysis results above and then this
section below, they should think: "I see what this becomes."

Do not modify app.py structure, analyzer.py, or sample_notes.py beyond what
is specified here. Only add the new section.

---

## WHAT TO BUILD

### New function in app.py: `render_realtime_preview(data)`

This function takes the same `data` dict that `render_results()` already
receives (the parsed JSON from the API call) and renders a new visual section
below the existing results.

Call it in app.py immediately after `render_results(result["data"])`:

```python
if result["data"] is not None:
    render_results(result["data"])
    render_realtime_preview(result["data"])  # ADD THIS LINE
```

---

## THE SECTION: "What This Looks Like in Real Time"

### Header

```
── How Speclyn works during the encounter ──
```

Display as a horizontal rule with centered label text above it. Style it
as a section divider, slightly muted, not as prominent as the main section
headers above.

### Intro text (display exactly this)

```
The analysis above ran on a completed note. In a live deployment, Speclyn
runs alongside your ambient scribe — reading the note as it forms, and
surfacing these questions to the physician before the encounter ends.
Here is what that moment looks like.
```

Font: small, muted color (#5A6B7B), italic. Same width as the rest of the
content.

---

### The Encounter Simulation

This is the main visual element. It simulates a clinical encounter UI —
think of it as a simplified mock of what a physician would see on a tablet
or a side panel during a patient visit.

**Layout:** A dark-background card (like a clinical workstation UI) containing:

1. A "live note" area showing the clinical note text — but displayed as if
   it's being typed in real time (use st.empty() or just display the full
   note text in a monospace font with a subtle "live" indicator)

2. A "Speclyn prompt" overlay card that appears over/beside the note,
   showing the FIRST clarification question from the analysis results

3. Two response buttons below the prompt: "Answer verbally" and "Skip for now"
   (these are visual only — clicking them shows a brief success/skip message
   but does not trigger any API call)

**Implementation details:**

Pull the first clarification question from the data:
```python
questions = data.get("clarification_questions", [])
if questions:
    first_q = questions[0]
    if isinstance(first_q, dict):
        question_text = first_q.get("question") or first_q.get("text") or ""
    else:
        question_text = str(first_q)
```

If no questions exist (well-documented note), show a green "Note is
coding-complete" state instead of the prompt card.

**Visual design of the simulation card:**

```
┌─────────────────────────────────────────────────────────┐
│  🔴 LIVE  · Encounter in progress                       │  ← dark navy header bar
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Clinical note text in monospace, muted white,         │
│   slightly faded to suggest it's still being written]   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  💬 Speclyn                                       │  │  ← prompt card, lighter bg
│  │                                                   │  │
│  │  [First clarification question text here]         │  │
│  │                                                   │  │
│  │  [Answer verbally]    [Skip for now]              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Colors:
- Outer card background: #0F1B2D (dark navy)
- Header bar: #0A1628 with a red dot (🔴) and "LIVE" in red (#E53E3E)
- Note text: #A0ADB8 (muted, suggests draft state)
- Prompt card background: #1A2F4A
- Prompt card border: #2D7DD2 (blue accent)
- Question text: #FFFFFF
- "Answer verbally" button: #1A7A4C (green, suggests positive action)
- "Skip for now" button: #2D3748 (dark, neutral)

Implement this as a single st.markdown() block with HTML/CSS. Do not use
st.button() for the simulation buttons — they would trigger reruns. Use
HTML button tags styled to look like buttons but with no action, or use
st.columns() with styled st.markdown() elements.

**Button behavior (session state):**

Add two keys to st.session_state for this section:
- `preview_answered`: bool, default False
- `preview_skipped`: bool, default False

If `preview_answered` is True, replace the button row with:
```
✓ Response captured — note updated automatically
```
In green text.

If `preview_skipped` is True, replace the button row with:
```
Prompt dismissed — query will be sent after encounter
```
In muted text.

Use st.button() OUTSIDE the HTML card for the actual clickable buttons —
place them below the simulation card in two columns. When clicked, set
the session state and rerun.

Reset both session state keys to False whenever a new analysis is run
(add the reset inside the `if analyze_clicked:` block in app.py).

---

### Below the simulation card

Add three stat pills in a horizontal row:

```
⏱ Prompt appears within 30 sec    📋 0 queries sent    💰 Revenue gap closed
```

Style as small rounded badge elements in a row. Use st.columns(3) with
centered markdown in each column.

Then add this caption below the pills:

```
In a live deployment, this prompt appears while the physician is still
in the room — not in a CDI queue days later.
```

---

### Final callout box

A lightly styled box at the very bottom of this section:

```
┌─────────────────────────────────────────────────────────┐
│  This demo runs on a completed note. In production,     │
│  Speclyn integrates directly with your ambient scribe   │
│  and EHR — surfacing prompts in real time, with full    │
│  HIPAA compliance and a BAA in place.                   │
│                                                         │
│  Interested in a pilot? → amitprakhar35@gmail.com       │
└─────────────────────────────────────────────────────────┘
```

Background: #EBF5FF, border: #BEE3F8, border-radius: 8px.
The email address should be a mailto link.
This is the only place in the entire demo where contact information appears.

---

## CSS TO ADD

Add these styles to the existing `st.markdown()` CSS block at the top of
app.py (inside the existing `<style>` tag, do not create a new one):

```css
.realtime-header {
    font-size: 0.78rem;
    font-weight: 600;
    color: #8A98A6;
    letter-spacing: 0.12em;
    text-align: center;
    margin: 2rem 0 0.4rem 0;
    text-transform: uppercase;
}
.realtime-intro {
    font-size: 0.92rem;
    color: #5A6B7B;
    font-style: italic;
    margin-bottom: 1.2rem;
    line-height: 1.6;
}
.encounter-card {
    background: #0F1B2D;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 1rem;
}
.encounter-header {
    background: #0A1628;
    padding: 0.6rem 1rem;
    font-size: 0.82rem;
    color: #8A98A6;
    border-bottom: 1px solid #1A2F4A;
}
.live-dot {
    color: #E53E3E;
    font-weight: 700;
    margin-right: 0.4rem;
}
.encounter-body {
    padding: 1.2rem;
}
.note-draft {
    font-family: 'Courier New', monospace;
    font-size: 0.88rem;
    color: #A0ADB8;
    line-height: 1.6;
    margin-bottom: 1.2rem;
    padding: 0.8rem;
    background: #0A1628;
    border-radius: 6px;
}
.speclyn-prompt-card {
    background: #1A2F4A;
    border: 1px solid #2D7DD2;
    border-radius: 8px;
    padding: 1rem 1.1rem;
    margin-bottom: 0.5rem;
}
.prompt-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #2D7DD2;
    margin-bottom: 0.5rem;
    letter-spacing: 0.05em;
}
.prompt-question {
    font-size: 1rem;
    color: #FFFFFF;
    line-height: 1.5;
}
.stat-pill {
    background: #F0F4F8;
    border: 1px solid #E2E8F0;
    border-radius: 20px;
    padding: 0.35rem 0.9rem;
    font-size: 0.82rem;
    color: #4A5568;
    text-align: center;
    margin: 0.5rem auto;
}
.pilot-callout {
    background: #EBF5FF;
    border: 1px solid #BEE3F8;
    border-radius: 8px;
    padding: 1.1rem 1.3rem;
    margin-top: 1rem;
    font-size: 0.92rem;
    color: #2C5282;
    line-height: 1.7;
}
.complete-state {
    background: #F0FFF4;
    border: 1px solid #9AE6B4;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    color: #276749;
    font-size: 0.95rem;
    text-align: center;
}
```

---

## EXACT FUNCTION SIGNATURE

```python
def render_realtime_preview(data: dict):
    """
    Render the 'What This Looks Like in Real Time' section.
    
    Takes the same parsed analysis dict as render_results().
    Displays a visual simulation of Speclyn during a live encounter.
    This is a storytelling/visualization component — not functional.
    """
```

---

## WHAT SUCCESS LOOKS LIKE

After implementing this:

1. Run the demo on Sample Note 1 (CHF + CKD + Diabetes — high gap scenario)
2. Scroll past the four analysis sections
3. You should see the section divider "HOW SPECLYN WORKS DURING THE ENCOUNTER"
4. Below it, the dark encounter card with the live note and Speclyn prompt
5. The first clarification question from the analysis appears inside the prompt card
6. Two columns with "Answer verbally" and "Skip for now" buttons below the card
7. Clicking "Answer verbally" shows the green confirmation text
8. Three stat pills appear below the card
9. The pilot callout box appears at the very bottom with the email link

Run on Sample Note 3 (well-documented) — the prompt card should be replaced
with the green "Note is coding-complete" state.

---

## DO NOT

- Do not make the simulation buttons trigger any API call
- Do not add any new files — all changes go in app.py only
- Do not modify analyzer.py or sample_notes.py
- Do not change any existing CSS class names
- Do not move or restructure existing render functions
- Do not add a second st.set_page_config() call

---

## CURRENT FILE STATE

- app.py: Complete, working, deployed
- analyzer.py: Complete, no changes needed
- sample_notes.py: Complete, no changes needed
- This instruction adds only to app.py

---

*Speclyn — Documentation Gap Analyzer*
*Feature: Real-Time Encounter Preview*
*Author: Amit Prakhar Pandey*
