"use client";

import { useEffect, useRef } from "react";

interface LiveTranscriptProps {
  transcript: string;
}

/**
 * Displays the accumulating encounter transcript with a blinking cursor,
 * auto-scrolled to the newest text.
 */
export default function LiveTranscript({ transcript }: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto rounded-lg border border-border bg-background p-5"
      aria-live="polite"
    >
      {transcript ? (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
          {transcript}
          <span
            className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-blink bg-primary"
            aria-hidden="true"
          />
        </p>
      ) : (
        <p className="text-muted">
          Listening… transcript will appear here as the encounter progresses.
          <span
            className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-blink bg-primary"
            aria-hidden="true"
          />
        </p>
      )}
    </div>
  );
}
