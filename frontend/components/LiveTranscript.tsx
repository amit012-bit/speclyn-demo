"use client";

import { useEffect, useRef } from "react";

interface LiveTranscriptProps {
  transcript: string;
  /** Unfinalized live STT turn — rendered dimmed/italic after the
   *  accumulated transcript until the turn finalizes. */
  partial?: string;
}

/**
 * Displays the accumulating encounter transcript with a blinking cursor,
 * auto-scrolled to the newest text. An in-flight partial turn (voice mode)
 * renders dimmed and italic ahead of the cursor.
 */
export default function LiveTranscript({
  transcript,
  partial,
}: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript, partial]);

  const cursor = (
    <span
      className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-blink bg-primary"
      aria-hidden="true"
    />
  );

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto rounded-lg border border-border bg-background p-5"
      aria-live="polite"
    >
      {transcript || partial ? (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
          {transcript}
          {partial && (
            <span className="italic text-muted">
              {transcript ? " " : ""}
              {partial}
            </span>
          )}
          {cursor}
        </p>
      ) : (
        <p className="text-muted">
          Listening… transcript will appear here as the encounter progresses.
          {cursor}
        </p>
      )}
    </div>
  );
}
