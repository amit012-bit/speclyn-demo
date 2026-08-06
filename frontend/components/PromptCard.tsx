"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClarificationQuestion } from "@/lib/api";

// Auto-collapse (not dismiss) after 45s of no interaction — the prompt
// parks in the queue chip instead of being silently lost (spec §3.5 / C3).
const AUTO_COLLAPSE_MS = 45_000;
const EXIT_ANIMATION_MS = 150; // enter is 200ms via CSS (§2.6)

interface PromptCardProps {
  question: ClarificationQuestion;
  /** Physician will answer out loud — the next transcript chunk captures it. */
  onAnswerVerbally: () => void;
  onSkip: () => void;
  /** 45s elapsed without interaction — parent parks this prompt in the
   *  queue chip. Never silently lost. */
  onCollapse: () => void;
  /** Prompts waiting behind this one (queue length − 1). */
  queuedCount?: number;
}

/** 16×16 inline SVG chat icon — replaces the chat emoji (B8). */
function ChatIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1D4ED8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

type Phase = "pre" | "in" | "out";

/**
 * The Speclyn clarification prompt — the moment that makes doctors feel
 * the product. Light card on the dark UI (deliberate polarity inversion),
 * blue left border, slides up from the bottom of the encounter panel.
 * After 45s of no interaction it collapses into the parent's queue chip.
 * The parent guarantees only one prompt is shown at a time (queued).
 */
export default function PromptCard({
  question,
  onAnswerVerbally,
  onSkip,
  onCollapse,
  queuedCount = 0,
}: PromptCardProps) {
  const [phase, setPhase] = useState<Phase>("pre");
  const cardRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const dismiss = useCallback((action: () => void) => {
    // Play the exit animation, then let the parent advance/park the prompt.
    setPhase("out");
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(action, EXIT_ANIMATION_MS);
  }, []);

  const handleAnswer = useCallback(
    () => dismiss(onAnswerVerbally),
    [dismiss, onAnswerVerbally]
  );
  const handleSkip = useCallback(() => dismiss(onSkip), [dismiss, onSkip]);

  // Slide in on mount / new question; auto-collapse to the queue after 45s.
  useEffect(() => {
    const enter = requestAnimationFrame(() => setPhase("in"));
    const autoCollapse = setTimeout(() => dismiss(onCollapse), AUTO_COLLAPSE_MS);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(autoCollapse);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
    // Re-run per question so each prompt gets its own 45s window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  // Focus management: move focus to the card on mount, return it on exit.
  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cardRef.current?.focus();
    return () => {
      const prev = previousFocusRef.current;
      if (prev && document.contains(prev)) prev.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  // Keyboard: Enter → Answer verbally, Escape → Skip.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      } else if (e.key === "Enter") {
        // Let a focused button keep its native Enter → click behavior.
        if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") {
          return;
        }
        e.preventDefault();
        handleAnswer();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleAnswer, handleSkip]);

  // Optional context line — rendered only when the API provides `why`.
  const why = (question as ClarificationQuestion & { why?: string }).why;
  const questionId = `prompt-question-${question.id}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4">
      <div
        ref={cardRef}
        tabIndex={-1}
        role="alertdialog"
        aria-labelledby={questionId}
        className={`pointer-events-auto w-full max-w-xl rounded-xl border-l-4 border-[#2563EB] bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,0.55)] outline-none transition-all ${
          phase === "in"
            ? "translate-y-0 opacity-100 duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
            : phase === "out"
              ? "translate-y-2 opacity-0 duration-150 ease-in"
              : "translate-y-4 opacity-0 duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        }`}
      >
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-[#1D4ED8]">
          <ChatIcon />
          Quick clarification
        </p>
        <p
          id={questionId}
          className="text-[17px] font-semibold leading-[1.5] text-[#111827]"
        >
          {question.question}
        </p>
        {why && (
          <p className="mt-1 truncate text-[13px] leading-[1.5] text-[#374151]">
            {why}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleAnswer}
            className="h-10 rounded-lg bg-primary-strong px-5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
          >
            Answer verbally
          </button>
          <button
            onClick={handleSkip}
            className="h-10 rounded-lg px-4 text-sm font-medium text-[#4B5563] transition hover:bg-[#E5E7EB] hover:text-[#111827]"
          >
            Skip
          </button>
          {queuedCount > 0 && (
            <span className="ml-auto text-xs text-[#6B7280]">
              +{queuedCount} more question{queuedCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
