"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type MicStatus = "requesting" | "granted" | "denied";

interface VoiceRecorderProps {
  /** Emits a transcript chunk (typed fallback today, AssemblyAI in Phase 4). */
  onTranscript: (text: string) => void;
}

const WAVEFORM_BARS = [0, 150, 300, 450, 600, 750, 900];

/**
 * Microphone capture via the Web Audio API (getUserMedia + MediaRecorder).
 *
 * PHASE 4 NOTE: streaming the captured audio to AssemblyAI is not wired up
 * yet. For now audio chunks are captured locally (audioChunksRef) so the
 * capture pipeline is proven, and a "type what you're saying" fallback input
 * emits transcript events over Socket.io so the realtime loop is testable
 * end-to-end today. If mic permission is denied we degrade gracefully to
 * text-only mode — never a blocking error.
 */
export default function VoiceRecorder({ onTranscript }: VoiceRecorderProps) {
  const [micStatus, setMicStatus] = useState<MicStatus>("requesting");
  const [typedText, setTypedText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function startCapture() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        setMicStatus("denied");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event: BlobEvent) => {
          // Phase 4: forward these chunks to AssemblyAI realtime STT.
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.start(1000); // 1s chunks
        setMicStatus("granted");
      } catch {
        // Permission denied or no device — fall back to text mode.
        if (!cancelled) setMicStatus("denied");
      }
    }

    startCapture();

    return () => {
      cancelled = true;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      audioChunksRef.current = [];
    };
  }, []);

  const handleTypedSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = typedText.trim();
    if (!text) return;
    onTranscript(text);
    setTypedText("");
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-4">
      {/* Recording status row */}
      {micStatus === "granted" ? (
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-sm font-medium text-red-400">
            <span
              className="h-3 w-3 animate-pulse-red rounded-full bg-red-500"
              aria-hidden="true"
            />
            Recording
          </span>
          {/* Simple CSS-animated waveform — no canvas needed */}
          <div
            className="flex h-8 items-center gap-1"
            aria-hidden="true"
          >
            {WAVEFORM_BARS.map((delay) => (
              <span
                key={delay}
                className="h-full w-1.5 origin-center animate-wave rounded-full bg-primary/80"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          <span className="text-xs text-muted">
            Audio captured locally — live transcription arrives in Phase 4
          </span>
        </div>
      ) : micStatus === "denied" ? (
        <p className="text-sm text-muted">
          Microphone unavailable — continuing in text mode. Type what you would
          say below.
        </p>
      ) : (
        <p className="text-sm text-muted">Requesting microphone access…</p>
      )}

      {/* Typed fallback — keeps the realtime loop testable end-to-end today */}
      <form onSubmit={handleTypedSubmit} className="flex gap-2">
        <input
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder="Type what you're saying…"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder-muted/60 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={!typedText.trim()}
          className="rounded-lg border border-primary/60 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
