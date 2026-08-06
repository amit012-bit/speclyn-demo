"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface LiveTranscriptProps {
  /** Accumulated finalized transcript (append-only). */
  finalText: string;
  /** Unfinalized live STT turn — rendered dimmed ahead of the cursor
   *  until the turn finalizes. Empty string for the typed fallback. */
  partialText: string;
  /** True while actually recording — shows the LIVE cluster. */
  live?: boolean;
  /** Encounter elapsed seconds — shown next to LIVE. */
  elapsedSeconds?: number;
  /** Extra header content (e.g. the parked-prompts queue chip). */
  headerExtra?: ReactNode;
}

/** How close to the bottom (px) still counts as "pinned to live". */
const PIN_THRESHOLD_PX = 40;

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * A finalized transcript segment. Mounts in the partial (dimmed) color and
 * commits to full body color over 150ms — the standard live-caption
 * partial→final treatment (spec §3.4).
 */
function CommittedSegment({ text }: { text: string }) {
  const [committed, setCommitted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setCommitted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span
      className={`transition-colors duration-150 ease-out ${
        committed ? "text-body" : "text-muted"
      }`}
    >
      {text}
    </span>
  );
}

/**
 * Displays the accumulating encounter transcript. Partial turns render
 * dimmed (never reflowed); finalized segments commit to full color and are
 * announced once to screen readers. Auto-scrolls only while the user is
 * pinned to the bottom; otherwise a "Jump to live" pill appears (fixes B6).
 */
export default function LiveTranscript({
  finalText,
  partialText,
  live = false,
  elapsedSeconds = 0,
  headerExtra,
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  // Append-only segment list — each committed chunk is its own node so the
  // aria-live region announces it exactly once (fixes B7) and the
  // partial→final color commit animates per segment.
  const [segments, setSegments] = useState<string[]>([]);
  const prevFinalRef = useRef("");
  useEffect(() => {
    const prev = prevFinalRef.current;
    if (finalText === prev) return;
    prevFinalRef.current = finalText;
    if (!finalText) {
      setSegments([]);
    } else if (finalText.startsWith(prev) && prev) {
      const appended = finalText.slice(prev.length);
      if (appended) setSegments((s) => [...s, appended]);
    } else {
      setSegments([finalText]);
    }
  }, [finalText]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const pinned =
      el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
    pinnedRef.current = pinned;
    if (pinned) setShowJump(false);
  };

  // Stick to bottom only when already near the bottom; otherwise surface
  // the "Jump to live" pill when new text arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (finalText || partialText) {
      setShowJump(true);
    }
  }, [finalText, partialText]);

  const jumpToLive = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    pinnedRef.current = true;
    setShowJump(false);
  };

  const cursor = (
    <span
      className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-blink bg-primary"
      aria-hidden="true"
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header row: section label + LIVE cluster */}
      <div className="mb-2 flex min-h-7 items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Transcript
        </span>
        <div className="flex items-center gap-3">
          {headerExtra}
          {live && (
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 animate-pulse-red rounded-full bg-danger"
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold tracking-widest text-danger-bright">
                LIVE
              </span>
              <span className="text-xs tabular-nums text-muted">
                {formatElapsed(elapsedSeconds)}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          role="log"
          className="h-full overflow-y-auto rounded-lg border border-border bg-background p-5"
        >
          {finalText || partialText ? (
            <p className="whitespace-pre-wrap text-[15px] leading-[1.7] tracking-[0.01em]">
              {/* Only finalized, append-only segments live in the live region */}
              <span aria-live="polite">
                {segments.map((segment, i) => (
                  <CommittedSegment key={i} text={segment} />
                ))}
              </span>
              {partialText && (
                <span aria-hidden="true" className="text-muted">
                  {finalText ? " " : ""}
                  {partialText}
                </span>
              )}
              {cursor}
            </p>
          ) : (
            <p className="text-muted">
              Listening… transcript will appear here as the encounter
              progresses.
              {cursor}
            </p>
          )}
        </div>

        {/* "Jump to live" pill — shown when scrolled up and new text arrives */}
        <button
          type="button"
          onClick={jumpToLive}
          aria-hidden={!showJump}
          tabIndex={showJump ? 0 : -1}
          className={`absolute bottom-3 left-1/2 h-8 -translate-x-1/2 rounded-full border border-border bg-elevated px-4 text-[12px] font-medium text-[#60A5FA] transition-opacity duration-150 ${
            showJump ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          Jump to live ↓
        </button>
      </div>
    </div>
  );
}
