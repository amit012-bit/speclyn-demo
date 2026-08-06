"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  analyzeNote,
  getToken,
  type AnalysisResult,
  type ClarificationQuestion,
} from "@/lib/api";
import { EncounterSocket, type RealtimeAnalysis } from "@/lib/websocket";
import VoiceRecorder from "./VoiceRecorder";
import LiveTranscript from "./LiveTranscript";
import PromptCard from "./PromptCard";

const FINAL_TIMEOUT_MS = 12_000;

type EncounterStatus = "idle" | "recording" | "finalizing";

interface EncounterPanelProps {
  /** Complete analysis (manual note or end-of-encounter) — replaces panel. */
  onCompleteAnalysis: (result: AnalysisResult) => void;
  /** Incremental realtime gaps — merged into the panel. */
  onRealtimeUpdate: (partial: RealtimeAnalysis) => void;
  /** A new encounter started — parent clears stale analysis. */
  onEncounterStart: () => void;
  onAnalyzingChange: (analyzing: boolean) => void;
}

export default function EncounterPanel({
  onCompleteAnalysis,
  onRealtimeUpdate,
  onEncounterStart,
  onAnalyzingChange,
}: EncounterPanelProps) {
  const [status, setStatus] = useState<EncounterStatus>("idle");
  const [noteText, setNoteText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [promptQueue, setPromptQueue] = useState<ClarificationQuestion[]>([]);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  const socketRef = useRef<EncounterSocket | null>(null);
  const seenPromptIdsRef = useRef<Set<string>>(new Set());
  const finalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `transcript` so handlers can read the accumulated text without
  // stale-closure issues. The engine expects the FULL transcript so far on
  // every "transcript" message (it replaces, not appends, its state).
  const transcriptRef = useRef("");

  // ---------------------------------------------------------------------
  // Manual note analysis (encounter stopped)
  // ---------------------------------------------------------------------
  const analyzeMutation = useMutation({
    mutationFn: () => analyzeNote({ note_text: noteText, mode: "complete" }),
    onSuccess: (result) => onCompleteAnalysis(result),
  });

  useEffect(() => {
    onAnalyzingChange(analyzeMutation.isPending);
  }, [analyzeMutation.isPending, onAnalyzingChange]);

  // ---------------------------------------------------------------------
  // Realtime encounter lifecycle
  // ---------------------------------------------------------------------
  const teardownSocket = useCallback(() => {
    if (finalTimeoutRef.current) {
      clearTimeout(finalTimeoutRef.current);
      finalTimeoutRef.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  useEffect(() => teardownSocket, [teardownSocket]);

  const startEncounter = () => {
    const token = getToken();
    if (!token) return;

    setTranscript("");
    transcriptRef.current = "";
    setPromptQueue([]);
    setRealtimeError(null);
    seenPromptIdsRef.current = new Set();
    onEncounterStart();

    const socket = new EncounterSocket();
    socketRef.current = socket;
    socket.connect(token, {
      onGaps: (partial) => {
        onRealtimeUpdate(partial);
        // Queue new clarification prompts — one PromptCard at a time.
        const incoming = partial.clarification_questions ?? [];
        const fresh = incoming.filter(
          (q) => q?.id && !seenPromptIdsRef.current.has(q.id)
        );
        if (fresh.length > 0) {
          fresh.forEach((q) => seenPromptIdsRef.current.add(q.id));
          setPromptQueue((queue) => [...queue, ...fresh]);
        }
      },
      onFinal: (result) => {
        if (finalTimeoutRef.current) clearTimeout(finalTimeoutRef.current);
        onCompleteAnalysis(result);
        teardownSocket();
        setStatus("idle");
        setPromptQueue([]);
      },
      onError: (err) => {
        // Never block the user — surface a dismissible notice and keep going.
        setRealtimeError(err.message);
      },
    });

    setStatus("recording");
  };

  const stopEncounter = () => {
    setStatus("finalizing");
    socketRef.current?.endEncounter();
    // If the "final" event never arrives, don't hang the UI.
    finalTimeoutRef.current = setTimeout(() => {
      teardownSocket();
      setStatus("idle");
      setPromptQueue([]);
    }, FINAL_TIMEOUT_MS);
  };

  /** A transcript chunk arrived (typed fallback today, AssemblyAI later).
   *  Accumulate locally and send the FULL transcript so far — the engine
   *  analyzes the complete encounter state each cycle, not deltas. */
  const handleTranscript = useCallback((text: string) => {
    const full = transcriptRef.current ? `${transcriptRef.current} ${text}` : text;
    transcriptRef.current = full;
    setTranscript(full);
    socketRef.current?.sendTranscript(full);
  }, []);

  const advancePromptQueue = useCallback(() => {
    setPromptQueue((queue) => queue.slice(1));
  }, []);

  const isLive = status === "recording" || status === "finalizing";
  const activePrompt = promptQueue[0];

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Current Encounter
        </h2>
        {status === "idle" ? (
          <button
            onClick={startEncounter}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Start Encounter
          </button>
        ) : (
          <button
            onClick={stopEncounter}
            disabled={status === "finalizing"}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-60"
          >
            {status === "finalizing" ? "Finalizing…" : "Stop Encounter"}
          </button>
        )}
      </div>

      {realtimeError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <span>{realtimeError}</span>
          <button
            onClick={() => setRealtimeError(null)}
            className="shrink-0 font-semibold hover:text-foreground"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {isLive ? (
        /* ------------------- Live encounter view ------------------- */
        <div className="flex flex-1 flex-col gap-4">
          <LiveTranscript transcript={transcript} />
          <VoiceRecorder onTranscript={handleTranscript} />
        </div>
      ) : (
        /* ------------------- Manual note entry --------------------- */
        <div className="flex flex-1 flex-col gap-4">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Paste or type a clinical note here… (synthetic data only)"
            className="min-h-[260px] flex-1 resize-none rounded-lg border border-border bg-background p-5 text-base leading-relaxed text-foreground placeholder-muted/60 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {analyzeMutation.isError && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
              {analyzeMutation.error instanceof Error
                ? analyzeMutation.error.message
                : "Analysis failed. Please try again."}
            </p>
          )}
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={!noteText.trim() || analyzeMutation.isPending}
            className="self-end rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzeMutation.isPending ? "Analyzing…" : "Analyze Note"}
          </button>
        </div>
      )}

      {/* One prompt at a time, overlaid at the bottom of this panel */}
      {isLive && activePrompt && (
        <PromptCard
          key={activePrompt.id}
          question={activePrompt}
          onAnswerVerbally={advancePromptQueue}
          onSkip={advancePromptQueue}
        />
      )}
    </div>
  );
}
