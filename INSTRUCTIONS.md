# Speclyn — Documentation Gap Analyzer
## Claude Code Instruction File
## Read this completely before writing a single line of code.

---

## WHAT WE ARE BUILDING

A web-based demo tool called the **Speclyn Documentation Gap Analyzer**.

This is a proof-of-concept for a healthcare AI startup called Speclyn, which sits between ambient clinical documentation AI and medical coding AI — detecting ICD-10/CPT specificity gaps and HCC capture opportunities in real time, before a clinical note is finalized.

The demo is NOT the full product. It is a focused tool that proves the core thesis to potential customers: paste in a real clinical note, get back a precise analysis of what's missing for coding, and see the estimated dollar impact of those gaps.

---

## TECH STACK

- **Frontend:** Streamlit (Python)
- **AI Engine:** Anthropic Claude API (claude-sonnet-4-6)
- **Language:** Python 3.10+
- **Deployment:** Streamlit Community Cloud (free)
- **Dependencies:** anthropic, streamlit, python-dotenv

No database. No authentication. No persistent storage. This is a stateless demo tool.

---

## FILE STRUCTURE

```
speclyn-demo/
├── app.py                  # Main Streamlit application
├── analyzer.py             # Claude API call logic and prompt engineering
├── sample_notes.py         # 3 sample clinical notes for demo purposes
├── requirements.txt        # Dependencies
├── .env                    # API key (never commit this)
├── .env.example            # Template for API key (commit this)
├── .gitignore              # Ignore .env
└── INSTRUCTIONS.md         # This file
```

---

## CORE FUNCTIONALITY

### Input
A plain text clinical note — pasted by the user into a text area.

### Output (structured, displayed cleanly in the UI)
The tool returns four things for every note analyzed:

1. **Specificity Gaps** — what ICD-10/CPT specificity is missing from the note, listed by condition with the specific missing element (e.g., "CHF: systolic vs diastolic not specified")

2. **HCC Capture Opportunities** — which HCC-relevant conditions are present but insufficiently documented for risk adjustment purposes (relevant for Medicare Advantage patients)

3. **Physician Clarification Questions** — the exact questions that should be asked of the physician in natural clinical language (not billing-speak), one per gap identified (e.g., "Was the patient's CHF systolic or diastolic?")

4. **Estimated Revenue Impact** — a dollar estimate of the total gap, based on industry benchmarks:
   - Each unspecified HCC condition: $900-$1,100 per member per year
   - Each undercoded visit: $50-$200 per encounter
   - Display as a range (e.g., "Estimated impact: $1,800 - $3,300 per patient per year")
   - Include a disclaimer that this is an estimate based on published CMS/industry benchmarks

---

## THE SYSTEM PROMPT (Critical — this is the heart of the product)

The Claude API call must use this system prompt exactly. Do not simplify or shorten it — the quality of the output depends entirely on the precision of this prompt.

```
You are a senior medical coding specialist and Clinical Documentation Improvement (CDI) expert with deep knowledge of ICD-10-CM, CPT coding guidelines, HCC (Hierarchical Condition Category) risk adjustment under CMS-HCC v28, and payer-specific LCD (Local Coverage Determination) policies.

Your job is to analyze clinical notes and identify documentation gaps that will cause revenue leakage — either through undercoding, specificity failures, or missed HCC capture opportunities.

You think like someone who has reviewed thousands of denied and undercoded claims and traced them back to the exact moment of documentation failure.

When analyzing a clinical note, you must:

1. SPECIFICITY GAPS: Identify every diagnosis mentioned or implied that lacks the specificity required for accurate ICD-10-CM coding. For each gap, name the condition, state what specificity is missing, and name the ICD-10 codes that could apply depending on the answer (from lowest to highest specificity).

2. HCC OPPORTUNITIES: Identify every chronic condition present in the note that is HCC-relevant under CMS-HCC v28 and assess whether it is documented with enough specificity and clinical context to be captured for risk adjustment. Flag conditions that are mentioned but not adequately "addressed" per CMS guidelines (conditions must be assessed, not merely listed).

3. CLARIFICATION QUESTIONS: For each gap identified, write the exact clarifying question a physician should be asked, in natural clinical language — not billing language. The question must feel like a colleague asking for clinical precision, not a coder demanding compliance. Each question must be specific, answerable in one sentence, and directly resolve the identified gap.

4. REVENUE IMPACT: Estimate the revenue impact of the identified gaps using these benchmarks:
   - Unspecified HCC condition (when specificity would change HCC weight): $900-$1,100 per member per year per 0.1 RAF point
   - Missed or underspecified chronic condition per encounter: $50-$200 per visit
   - Calculate a total range across all identified gaps
   - State assumptions clearly

CRITICAL RULES:
- Never invent conditions not present or implied in the note
- Never suggest upcoding — only accurate, specific, defensible coding
- If the note is already well-documented, say so clearly and specifically
- Always explain WHY each gap matters for coding, not just that it exists
- Write clarification questions in plain English a physician would actually respond to

Output format: structured JSON with four keys: "specificity_gaps", "hcc_opportunities", "clarification_questions", "revenue_impact". Each key contains an array of objects. Revenue impact also contains a "total_range" object with "low" and "high" integer values in USD, and an "assumptions" string.
```

---

## THE USER PROMPT TEMPLATE

```python
user_prompt = f"""
Please analyze the following clinical note for documentation gaps, HCC capture opportunities, and revenue impact.

CLINICAL NOTE:
{note_text}

Return your analysis as valid JSON only. No preamble, no explanation outside the JSON structure.
"""
```

---

## UI DESIGN REQUIREMENTS

The UI must feel professional and clinical — not like a toy demo. Follow these design rules:

**Layout:**
- Clean single-column layout with a sidebar for sample notes
- Speclyn logo/name at the top (text is fine, no image needed)
- Tagline: "Closing the gap between documentation AI and coding AI"
- Text area for note input: tall (min 300px), placeholder text should be a short example note snippet
- Single "Analyze Note" button — prominent, full width
- Results appear below in clearly separated sections

**Results Display:**
- Each of the four output sections gets its own styled container
- Section headers: "Specificity Gaps", "HCC Opportunities", "Clarification Questions", "Revenue Impact"
- Revenue Impact section: display the total range in large text (e.g., "$1,800 — $3,300") with the assumptions below in small text
- Clarification Questions: display as a numbered list, each question in a distinct visual box — these are the most actionable output and should look like it
- Add a disclaimer at the bottom: "Revenue estimates are based on published CMS/HCC benchmarks and industry standards. Actual impact varies by payer, specialty, and patient population."

**Loading State:**
- Show a spinner with the text "Analyzing documentation gaps..." while the API call runs
- Estimated wait: 3-8 seconds

**Error Handling:**
- If the API call fails: show a clean error message, not a Python traceback
- If the note is too short (under 50 characters): show "Please paste a complete clinical note for accurate analysis"
- If the JSON parsing fails: show the raw text response rather than crashing

---

## SAMPLE NOTES (3 required)

These go in sample_notes.py and appear in the sidebar as one-click examples.

**Sample 1 — High gap scenario (cardiology + diabetes + CKD)**
```
Patient is a 68-year-old male with CHF, CKD, and diabetes presenting for follow-up. Doing reasonably well overall. Blood pressure controlled. Continue current medications. Follow up in 3 months.
```

**Sample 2 — Medium gap scenario (COPD + depression)**
```
Patient presents with COPD follow-up. Reports some shortness of breath with exertion, better than last visit. Also mentions feeling down lately, not sleeping well. Reviewed medications, no changes. Return in 6 weeks.
```

**Sample 3 — Low gap scenario (well-documented)**
```
Patient is a 72-year-old female with systolic congestive heart failure (HFrEF, EF 35%), Stage 3b chronic kidney disease (eGFR 32), and Type 2 diabetes mellitus with diabetic peripheral neuropathy. All three conditions were reviewed and addressed today. Current HbA1c 7.8. Continuing lisinopril, furosemide, and metformin. Patient educated on fluid restriction. Follow up in 4 weeks.
```

---

## ENVIRONMENT SETUP

**.env file (never commit):**
```
ANTHROPIC_API_KEY=your_key_here
```

**.env.example (commit this):**
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**requirements.txt:**
```
anthropic>=0.25.0
streamlit>=1.35.0
python-dotenv>=1.0.0
```

---

## DEPLOYMENT (Streamlit Community Cloud)

1. Push code to a GitHub repo (make sure .env is in .gitignore)
2. Go to share.streamlit.io
3. Connect GitHub repo
4. Add ANTHROPIC_API_KEY as a secret in the Streamlit Cloud dashboard
5. Deploy — free, permanent URL, no credit card

---

## WHAT SUCCESS LOOKS LIKE

When you paste Sample Note 1 (CHF + CKD + diabetes) into the tool and hit Analyze, the output should:
- Identify at least 3 specificity gaps (CHF systolic vs diastolic, CKD stage, diabetes with/without complications)
- Flag at least 2 HCC opportunities
- Generate 3 physician clarification questions in plain clinical English
- Show a revenue impact estimate with a dollar range and stated assumptions
- Render cleanly in the UI with no errors, no raw JSON visible to the user

If it does all five of these things on the first try with a real clinical note — the demo is ready to show to a potential customer.

---

## WHAT THIS DEMO IS NOT

- It is not a HIPAA-compliant production system
- It does not store any patient data
- It is not connected to any EHR
- It does not replace a certified medical coder or CDI specialist

When showing this to any potential customer, always state upfront: "This is a proof-of-concept demo. In a real deployment, this runs inside your EHR environment with full HIPAA compliance and BAA in place."

---

## CURRENT STATUS

- Instructions: Complete
- Code: Not yet written — start with app.py and analyzer.py
- Sample notes: Defined above, need to be put in sample_notes.py
- Deployment: Pending code completion

---

*Last updated: June 2026*
*Project: Speclyn — Documentation Gap Analyzer Demo*
*Founder: Amit Prakhar Pandey*
