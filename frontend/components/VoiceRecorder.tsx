"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSttToken, type SttTokenResponse } from "@/lib/api";
import { MicCapture, MicPermissionError } from "@/lib/audio";

type VoiceStatus = "connecting" | "recording" | "unavailable";

interface VoiceRecorderProps {
  /** Emits a FINAL transcript turn — the parent accumulates the full text. */
  onTranscript: (text: string) => void;
  /** Live unfinalized turn text (cleared with "" when the turn finalizes). */
  onPartial?: (text: string) => void;
}

const WAVEFORM_BARS = [0, 150, 300, 450, 600, 750, 900];

const ASSEMBLYAI_WSS = "wss://streaming.assemblyai.com/v3/ws";

/** Shape of AssemblyAI v3 streaming messages we care about. */
interface AssemblyAiTurnMessage {
  type?: string;
  transcript?: string;
  end_of_turn?: boolean;
}

/**
 * Real-time voice transcription via AssemblyAI v3 streaming.
 *
 * The browser fetches a short-lived token from the backend
 * (GET /analysis/stt-token), opens a native WebSocket directly to
 * AssemblyAI, and streams 16 kHz mono PCM16 chunks captured through
 * lib/audio.ts (AudioWorklet). Final turns feed the existing realtime loop
 * via onTranscript; unfinalized turns surface through onPartial.
 *
 * Degradation is never blocking: any failure (token fetch, mic permission,
 * socket error) logs a console.warn, shows a dismissible notice, and the
 * typed fallback below keeps the realtime loop fully usable.
 */
export default function VoiceRecorder({
  onTranscript,
  onPartial,
}: VoiceRecorderProps) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("connecting");
  const [notice, setNotice] = useState<string | null>(null);
  const [typedText, setTypedText] = useState("");

  // Callback refs so the streaming effect never sees stale closures and can
  // keep an empty dependency list (one STT session per mount).
  const onTranscriptRef = useRef(onTranscript);
  const onPartialRef = useRef(onPartial);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onPartialRef.current = onPartial;
  });

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let mic: MicCapture | null = null;
    let retriedWithoutKeyterms = false;

    /** Terminate the STT session and release the mic. NEVER leave a session
     *  open — AssemblyAI bills until Terminate is sent. */
    const cleanup = () => {
      mic?.stop();
      mic = null;
      if (ws) {
        const socket = ws;
        ws = null;
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: "Terminate" }));
          } catch {
            // Socket already closing — nothing to terminate.
          }
        }
        socket.close();
      }
    };

    /** Non-blocking degradation: warn, notify, keep the typed fallback. */
    const degrade = (reason: string) => {
      console.warn(`[VoiceRecorder] ${reason} — falling back to text mode.`);
      cleanup();
      if (!cancelled) {
        setVoiceStatus("unavailable");
        setNotice("Voice unavailable — using text mode");
        onPartialRef.current?.("");
      }
    };

    const openSocket = (creds: SttTokenResponse, includeKeyterms: boolean) => {
      const params = new URLSearchParams({
        sample_rate: "16000",
        speech_model: "universal-3-5-pro",
        mode: "balanced",
        domain: creds.domain,
        token: creds.token,
      });
      if (includeKeyterms && creds.keyterms.length > 0) {
        params.set("keyterms_prompt", JSON.stringify(creds.keyterms));
      }

      // Set once the server sends ANY message — an immediate close before
      // that means the session was rejected (bad param, e.g. keyterms).
      let sessionBegan = false;

      const socket = new WebSocket(`${ASSEMBLYAI_WSS}?${params.toString()}`);
      socket.binaryType = "arraybuffer";
      ws = socket;

      socket.onopen = async () => {
        if (cancelled || ws !== socket) return;
        try {
          const capture = new MicCapture();
          mic = capture;
          await capture.start((chunk) => {
            if (socket.readyState === WebSocket.OPEN) socket.send(chunk);
          });
          if (cancelled || ws !== socket) {
            capture.stop();
            return;
          }
          setVoiceStatus("recording");
        } catch (err) {
          degrade(
            err instanceof MicPermissionError
              ? err.message
              : `Mic capture failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      };

      socket.onmessage = (event: MessageEvent) => {
        if (cancelled || ws !== socket) return;
        sessionBegan = true;
        let msg: AssemblyAiTurnMessage;
        try {
          msg = JSON.parse(String(event.data)) as AssemblyAiTurnMessage;
        } catch {
          return; // Non-JSON frame — ignore.
        }
        if (msg.type !== "Turn") return;
        const text = typeof msg.transcript === "string" ? msg.transcript : "";
        if (msg.end_of_turn === true) {
          // Final turn — feed the realtime loop; parent accumulates.
          if (text.trim()) onTranscriptRef.current(text.trim());
          onPartialRef.current?.("");
        } else {
          // Live partial — shown dimmed/italic in LiveTranscript.
          onPartialRef.current?.(text);
        }
      };

      socket.onclose = (event: CloseEvent) => {
        if (cancelled || ws !== socket) return;
        // Graceful degradation: if AssemblyAI rejects the session right away
        // (error/4xx-like close before any message) and we sent
        // keyterms_prompt, retry ONCE without it.
        if (!sessionBegan && includeKeyterms && !retriedWithoutKeyterms) {
          retriedWithoutKeyterms = true;
          console.warn(
            `[VoiceRecorder] AssemblyAI closed the session immediately (code ${event.code}) with keyterms_prompt set — retrying once without keyterms.`
          );
          mic?.stop();
          mic = null;
          setVoiceStatus("connecting");
          openSocket(creds, false);
          return;
        }
        degrade(`AssemblyAI socket closed (code ${event.code})`);
      };

      socket.onerror = () => {
        // onclose always follows onerror — degradation is handled there.
      };
    };

    (async () => {
      try {
        const creds = await getSttToken();
        if (cancelled) return;
        openSocket(creds, creds.keyterms.length > 0);
      } catch (err) {
        degrade(
          `STT token fetch failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
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
      {/* Dismissible voice-failure notice — never blocks the encounter */}
      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            className="shrink-0 font-semibold hover:text-foreground"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Recording status row — driven by the actual streaming state */}
      {voiceStatus === "recording" ? (
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-sm font-medium text-red-400">
            <span
              className="h-3 w-3 animate-pulse-red rounded-full bg-red-500"
              aria-hidden="true"
            />
            Recording
          </span>
          {/* Simple CSS-animated waveform — no canvas needed */}
          <div className="flex h-8 items-center gap-1" aria-hidden="true">
            {WAVEFORM_BARS.map((delay) => (
              <span
                key={delay}
                className="h-full w-1.5 origin-center animate-wave rounded-full bg-primary/80"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          <span className="text-xs text-muted">
            Live transcription via AssemblyAI
          </span>
        </div>
      ) : voiceStatus === "unavailable" ? (
        <p className="text-sm text-muted">
          Microphone transcription unavailable — continuing in text mode. Type
          what you would say below.
        </p>
      ) : (
        <p className="text-sm text-muted">Connecting live transcription…</p>
      )}

      {/* Typed fallback — always usable, even mid-recording or if voice fails */}
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
