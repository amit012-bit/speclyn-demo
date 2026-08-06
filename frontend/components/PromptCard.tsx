"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClarificationQuestion } from "@/lib/api";

const AUTO_DISMISS_MS = 30_000;
const EXIT_ANIMATION_MS = 300;

interface PromptCardProps {
  question: ClarificationQuestion;
  /** Physician will answer out loud — the next transcript chunk captures it. */
  onAnswerVerbally: () => void;
  onSkip: () => void;
}

/**
 * The Speclyn clarification prompt — the moment that makes doctors feel
 * the product. Light card on the dark UI, blue left border, slides up from
 * the bottom of the encounter panel. Auto-dismisses after 30 seconds.
 * The parent guarantees only one prompt is shown at a time (queued).
 */
export default function PromptCard({
  question,
  onAnswerVerbally,
  onSkip,
}: PromptCardProps) {
  const [visible, setVisible] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(
    (action: () => void) => {
      // Slide down, then let the parent advance the queue.
      setVisible(false);
      if (exitTimer.current) clearTimeout(exitTimer.current);
      exitTimer.current = setTimeout(action, EXIT_ANIMATION_MS);
    },
    []
  );

  // Slide in on mount / when a new question arrives; auto-dismiss after 30s.
  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true));
    const autoDismiss = setTimeout(() => dismiss(onSkip), AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(autoDismiss);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
    // Re-run per question so each prompt gets its own 30s window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4">
      <div
        role="alertdialog"
        aria-label="Quick clarification"
        className={`pointer-events-auto w-full max-w-xl rounded-xl border-l-4 border-primary bg-gray-50 p-5 shadow-2xl shadow-black/50 transition-all duration-300 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-primary">
          💬 Quick clarification
        </p>
        <p className="mb-4 text-lg font-medium leading-snug text-gray-900">
          {question.question}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => dismiss(onAnswerVerbally)}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Answer verbally
          </button>
          <button
            onClick={() => dismiss(onSkip)}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
