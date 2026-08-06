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

// Simulation pacing — one sentence chunk every ~1.5s mimics live speech,
// then ~2s of settle time so the engine's last "gaps" cycle can land.
const SIM_CHUNK_INTERVAL_MS = 1_500;
const SIM_END_DELAY_MS = 2_000;
const SIM_MIN_CHARS = 50;

type EncounterStatus = "idle" | "recording" | "simulating" | "finalizing";

/** Split a pasted chart into sentence chunks for replay. Falls back to
 *  fixed ~120-char pieces when no sentence punctuation is present. */
function chunkForSimulation(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length > 1) return sentences;
  // No sentence boundaries — replay fixed-size pieces instead.
  const pieces: string[] = [];
  for (let i = 0; i < trimmed.length; i += 120) {
    pieces.push(trimmed.slice(i, i + 120).trim());
  }
  return pieces.filter(Boolean);
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Session stat — 11px uppercase label over a tabular-nums value (§3.3). */
function SessionStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="text-[15px] font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

interface EncounterPanelProps {
  /** Complete analysis (manual note or end-of-encounter) — replaces panel. */
  onCompleteAnalysis: (result: AnalysisResult) => void;
  /** Incremental realtime gaps — merged into the panel. */
  onRealtimeUpdate: (partial: RealtimeAnalysis) => void;
  /** A new encounter started — parent clears stale analysis. */
  onEncounterStart: () => void;
  onAnalyzingChange: (analyzing: boolean) => void;
  /** Recording status lifted to the dashboard StatusBadge (§3.2). */
  onStatusChange?: (isRecording: boolean) => void;
  /** A clarification prompt was answered — parent marks its gap resolved. */
  onPromptAnswered?: (promptId: string) => void;
}

export default function EncounterPanel({
  onCompleteAnalysis,
  onRealtimeUpdate,
  onEncounterStart,
  onAnalyzingChange,
  onStatusChange,
  onPromptAnswered,
}: EncounterPanelProps) {
  const [status, setStatus] = useState<EncounterStatus>("idle");
  const [noteText, setNoteText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [partialText, setPartialText] = useState("");
  const [promptQueue, setPromptQueue] = useState<ClarificationQuestion[]>([]);
  const [parkedPrompts, setParkedPrompts] = useState<ClarificationQuestion[]>([]);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [isSimulation, setIsSimulation] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [gapCount, setGapCount] = useState(0);
  const [promptCount, setPromptCount] = useState(0);

  const socketRef = useRef<EncounterSocket | null>(null);
  const seenPromptIdsRef = useRef<Set<string>>(new Set());
  const seenGapIdsRef = useRef<Set<string>>(new Set());
  const finalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    // "Finalizing" also reads as Analyzing in the StatusBadge (§3.3).
    onAnalyzingChange(analyzeMutation.isPending || status === "finalizing");
  }, [analyzeMutation.isPending, status, onAnalyzingChange]);

  useEffect(() => {
    onStatusChange?.(status === "recording" || status === "simulating");
  }, [status, onStatusChange]);

  // ---------------------------------------------------------------------
  // Realtime encounter lifecycle
  // ---------------------------------------------------------------------
  const clearSimulationTimers = useCallback(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    if (simEndTimeoutRef.current) {
      clearTimeout(simEndTimeoutRef.current);
      simEndTimeoutRef.current = null;
    }
  }, []);

  const teardownSocket = useCallback(() => {
    clearSimulationTimers();
    if (finalTimeoutRef.current) {
      clearTimeout(finalTimeoutRef.current);
      finalTimeoutRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, [clearSimulationTimers]);

  useEffect(() => teardownSocket, [teardownSocket]);

  /** A transcript chunk arrived (typed fallback, AssemblyAI final turn, or
   *  simulation replay). Accumulate locally and send the FULL transcript so
   *  far — the engine analyzes the complete encounter state each cycle, not
   *  deltas. */
  const handleTranscript = useCallback((text: string) => {
    const full = transcriptRef.current ? `${transcriptRef.current} ${text}` : text;
    transcriptRef.current = full;
    setTranscript(full);
    socketRef.current?.sendTranscript(full);
  }, []);

  /** Live unfinalized STT turn — rendered dimmed in LiveTranscript. */
  const handlePartial = useCallback((text: string) => {
    setPartialText(text);
  }, []);

  /** Reset per-encounter state and open the realtime socket. Shared by real
   *  (voice) encounters and simulations — same handlers, same PromptCard
   *  queueing, same "final" flow. Returns false if there is no auth token. */
  const beginEncounter = (nextStatus: "recording" | "simulating"): boolean => {
    const token = getToken();
    if (!token) return false;

    clearSimulationTimers();
    setTranscript("");
    transcriptRef.current = "";
    setPartialText("");
    setPromptQueue([]);
    setParkedPrompts([]);
    setRealtimeError(null);
    seenPromptIdsRef.current = new Set();
    seenGapIdsRef.current = new Set();
    setGapCount(0);
    setPromptCount(0);
    setIsSimulation(nextStatus === "simulating");
    onEncounterStart();

    // Session duration — 1s interval for the stat row + LIVE timer (§3.3).
    setElapsedSeconds(0);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = setInterval(
      () => setElapsedSeconds((s) => s + 1),
      1000
    );

    const socket = new EncounterSocket();
    socketRef.current = socket;
    socket.connect(token, {
      onGaps: (partial) => {
        onRealtimeUpdate(partial);
        // Track unique gaps for the session stat row.
        const gaps = partial.specificity_gaps ?? [];
        for (const gap of gaps) {
          if (gap?.id) seenGapIdsRef.current.add(gap.id);
        }
        setGapCount(seenGapIdsRef.current.size);
        // Queue new clarification prompts — one PromptCard at a time.
        const incoming = partial.clarification_questions ?? [];
        const fresh = incoming.filter(
          (q) => q?.id && !seenPromptIdsRef.current.has(q.id)
        );
        if (fresh.length > 0) {
          fresh.forEach((q) => seenPromptIdsRef.current.add(q.id));
          setPromptQueue((queue) => [...queue, ...fresh]);
        }
        setPromptCount(seenPromptIdsRef.current.size);
      },
      onFinal: (result) => {
        if (finalTimeoutRef.current) clearTimeout(finalTimeoutRef.current);
        onCompleteAnalysis(result);
        teardownSocket();
        setStatus("idle");
        setIsSimulation(false);
        setPartialText("");
        setPromptQueue([]);
        setParkedPrompts([]);
      },
      onError: (err) => {
        // Never block the user — surface a dismissible notice and keep going.
        setRealtimeError(err.message);
      },
    });

    setStatus(nextStatus);
    return true;
  };

  const startEncounter = () => {
    beginEncounter("recording");
  };

  /** Ends the current encounter (voice or simulation) through the normal
   *  finalizing flow. For simulations this doubles as "Stop Simulation":
   *  it aborts the replay interval and finalizes whatever was fed so far. */
  const stopEncounter = () => {
    clearSimulationTimers();
    setPartialText("");
    setStatus("finalizing");
    socketRef.current?.endEncounter();
    // If the "final" event never arrives, don't hang the UI.
    finalTimeoutRef.current = setTimeout(() => {
      teardownSocket();
      setStatus("idle");
      setIsSimulation(false);
      setPromptQueue([]);
      setParkedPrompts([]);
    }, FINAL_TIMEOUT_MS);
  };

  /**
   * SIMULATION MODE — "Simulate Live Encounter".
   *
   * Purpose: lets developers and demos validate that proper clarification
   * questions arrive through the FULL realtime stack (Socket.io -> Node
   * backend -> Python engine -> "gaps" -> PromptCards -> "final") without
   * spending any AssemblyAI credit: no microphone or STT session is opened.
   * The pasted chart is replayed sentence-by-sentence through the exact same
   * handleTranscript flow a live voice encounter uses.
   */
  const startSimulation = () => {
    const chunks = chunkForSimulation(noteText);
    if (chunks.length === 0) return;
    if (!beginEncounter("simulating")) return;

    let index = 0;
    const feedNextChunk = () => {
      handleTranscript(chunks[index]);
      index += 1;
      if (index >= chunks.length) {
        // Replay complete — give the engine ~2s for its last "gaps" cycle,
        // then end through the same stop/finalizing flow as a real encounter.
        clearSimulationTimers();
        simEndTimeoutRef.current = setTimeout(stopEncounter, SIM_END_DELAY_MS);
      }
    };

    // First chunk immediately so the transcript starts growing at once,
    // then one chunk per interval so gaps/PromptCards arrive mid-replay.
    feedNextChunk();
    if (index < chunks.length) {
      simIntervalRef.current = setInterval(feedNextChunk, SIM_CHUNK_INTERVAL_MS);
    }
  };

  const advancePromptQueue = useCallback(() => {
    setPromptQueue((queue) => queue.slice(1));
  }, []);

  const isLive =
    status === "recording" || status === "simulating" || status === "finalizing";
  const activePrompt = promptQueue[0];
  const canSimulate = noteText.trim().length >= SIM_MIN_CHARS;

  /** The active prompt was answered verbally — advance and tell the parent
   *  so the matching gap card can render as resolved. */
  const handleAnswerVerbally = () => {
    if (activePrompt) onPromptAnswered?.(activePrompt.id);
    advancePromptQueue();
  };

  /** 45s with no interaction — park the active prompt in the queue chip
   *  instead of discarding it (§3.5, C3). */
  const handleCollapse = () => {
    if (!activePrompt) return;
    setParkedPrompts((parked) => [...parked, activePrompt]);
    setPromptQueue((queue) => queue.slice(1));
  };

  /** Queue chip clicked — re-activate the first parked prompt. */
  const reactivateParkedPrompt = () => {
    const first = parkedPrompts[0];
    if (!first) return;
    setParkedPrompts((parked) => parked.slice(1));
    setPromptQueue((queue) => [first, ...queue]);
  };

  // Parked-prompts queue chip — rendered in the transcript header area (§3.3).
  const queueChip =
    parkedPrompts.length > 0 ? (
      <button
        type="button"
        onClick={reactivateParkedPrompt}
        className="flex h-7 items-center rounded-full border border-warning/40 bg-warning/10 px-3 text-[12px] text-warning-bright transition hover:bg-warning/20"
      >
        {parkedPrompts.length} clarification
        {parkedPrompts.length === 1 ? "" : "s"} waiting
      </button>
    ) : null;

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
            className="flex h-10 items-center gap-2 rounded-lg bg-primary-strong px-5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
          >
            <span
              className="h-2 w-2 rounded-full bg-foreground/60"
              aria-hidden="true"
            />
            Start Encounter
          </button>
        ) : (
          <button
            onClick={stopEncounter}
            disabled={status === "finalizing"}
            className="flex h-10 items-center gap-2 rounded-lg bg-danger-strong px-5 text-sm font-semibold text-white transition hover:bg-[#B91C1C] disabled:cursor-wait disabled:opacity-60"
          >
            <span
              className="h-2 w-2 animate-pulse-red rounded-full bg-[#FCA5A5]"
              aria-hidden="true"
            />
            {status === "finalizing"
              ? "Finalizing…"
              : status === "simulating"
                ? "Stop Simulation"
                : "Stop Encounter"}
          </button>
        )}
      </div>

      {/* Session stat row — directly under the panel header (§3.3) */}
      {isLive && (
        <div className="mb-4 flex gap-6">
          <SessionStat label="Duration" value={formatDuration(elapsedSeconds)} />
          <SessionStat label="Gaps found" value={gapCount} />
          <SessionStat label="Prompts" value={promptCount} />
        </div>
      )}

      {realtimeError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger-bright">
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
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <LiveTranscript
            finalText={transcript}
            partialText={partialText}
            live={status === "recording"}
            elapsedSeconds={elapsedSeconds}
            headerExtra={queueChip}
          />
          {isSimulation ? (
            /* Simulation banner replaces the mic — no VoiceRecorder here */
            <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-background p-4">
              <span className="rounded bg-warning px-2.5 py-1 text-xs font-bold tracking-widest text-background">
                SIMULATION
              </span>
              <span className="text-xs text-muted">
                Replaying pasted chart through the realtime pipeline — no
                audio captured, no transcription credit used
              </span>
            </div>
          ) : (
            <VoiceRecorder
              onTranscript={handleTranscript}
              onPartial={handlePartial}
            />
          )}
        </div>
      ) : (
        /* ------------------- Manual note entry --------------------- */
        <div className="flex flex-1 flex-col gap-4">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Patient is a 68-year-old male with CHF, CKD, and Type 2 diabetes presenting for routine follow-up…"
            className="min-h-[260px] flex-1 resize-none rounded-lg border border-border-strong bg-background p-5 text-[15px] leading-[1.7] text-body placeholder-muted outline-none transition focus:border-primary"
          />
          {analyzeMutation.isError && (
            <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger-bright">
              {analyzeMutation.error instanceof Error
                ? analyzeMutation.error.message
                : "Analysis failed. Please try again."}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={startSimulation}
              disabled={!canSimulate || analyzeMutation.isPending}
              title="Replay this note through the live encounter pipeline (no transcription credit used)"
              className="h-10 rounded-lg border border-warning/60 px-5 text-sm font-semibold text-warning transition hover:bg-warning hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
            >
              ▶ Simulate Live Encounter
            </button>
            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={!noteText.trim() || analyzeMutation.isPending}
              className="h-10 rounded-lg bg-primary-strong px-5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzeMutation.isPending ? "Analyzing…" : "Analyze Note"}
            </button>
          </div>
        </div>
      )}

      {/* One prompt at a time, overlaid at the bottom of this panel */}
      {isLive && activePrompt && (
        <PromptCard
          key={activePrompt.id}
          question={activePrompt}
          onAnswerVerbally={handleAnswerVerbally}
          onSkip={advancePromptQueue}
          onCollapse={handleCollapse}
          queuedCount={promptQueue.length - 1}
        />
      )}
    </div>
  );
}
