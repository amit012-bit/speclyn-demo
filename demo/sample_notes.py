"""
sample_notes.py — Sample clinical notes for the Speclyn demo.

These appear in the sidebar as one-click examples. Each note represents a
different documentation-gap scenario so a prospective customer can see the
tool's behavior across the spectrum from high-gap to well-documented.
"""

SAMPLE_NOTES = {
    "Sample 1 — High gap (CHF + CKD + diabetes)": (
        "Patient is a 68-year-old male with CHF, CKD, and diabetes presenting "
        "for follow-up. Doing reasonably well overall. Blood pressure "
        "controlled. Continue current medications. Follow up in 3 months."
    ),
    "Sample 2 — Medium gap (COPD + depression)": (
        "Patient presents with COPD follow-up. Reports some shortness of breath "
        "with exertion, better than last visit. Also mentions feeling down "
        "lately, not sleeping well. Reviewed medications, no changes. Return in "
        "6 weeks."
    ),
    "Sample 3 — Low gap (well-documented)": (
        "Patient is a 72-year-old female with systolic congestive heart failure "
        "(HFrEF, EF 35%), Stage 3b chronic kidney disease (eGFR 32), and Type 2 "
        "diabetes mellitus with diabetic peripheral neuropathy. All three "
        "conditions were reviewed and addressed today. Current HbA1c 7.8. "
        "Continuing lisinopril, furosemide, and metformin. Patient educated on "
        "fluid restriction. Follow up in 4 weeks."
    ),
}
