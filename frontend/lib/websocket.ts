/**
 * Socket.io client wrapper for the real-time encounter loop.
 *
 * Protocol (Node.js backend on ws://localhost:4000):
 *   - Handshake auth: { token } (the JWT from /auth/login)
 *   - emit "transcript" { text }  -> transcript chunk as it arrives
 *   - on   "gaps"                 -> incremental analysis (new gaps only)
 *   - on   "final"                -> complete end-of-encounter analysis
 *   - on   "error"                -> server-side failure for this encounter
 *   - emit "end"                  -> finish the encounter (server replies "final")
 */

import { io, type Socket } from "socket.io-client";
import type { AnalysisResult } from "./api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";

/** Realtime payloads may be partial — only new gaps are pushed each cycle. */
export type RealtimeAnalysis = Partial<AnalysisResult>;

export interface EncounterSocketCallbacks {
  /** Incremental gap analysis during a live encounter. */
  onGaps?: (analysis: RealtimeAnalysis) => void;
  /** Final complete analysis after "end" is emitted. */
  onFinal?: (analysis: AnalysisResult) => void;
  /** Server-side error for this encounter (non-fatal to the UI). */
  onError?: (error: { message: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export class EncounterSocket {
  private socket: Socket | null = null;

  /** Open an authenticated socket for one encounter session. */
  connect(token: string, callbacks: EncounterSocketCallbacks = {}): void {
    if (this.socket) this.disconnect();

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 3,
    });

    this.socket.on("connect", () => callbacks.onConnect?.());
    this.socket.on("disconnect", () => callbacks.onDisconnect?.());

    this.socket.on("gaps", (data: RealtimeAnalysis) => {
      callbacks.onGaps?.(data ?? {});
    });

    this.socket.on("final", (data: AnalysisResult) => {
      callbacks.onFinal?.(data);
    });

    this.socket.on("error", (err: { message?: string } | string) => {
      const message =
        typeof err === "string" ? err : err?.message ?? "Realtime analysis error";
      callbacks.onError?.({ message });
    });

    this.socket.on("connect_error", (err: Error) => {
      callbacks.onError?.({
        message: `Realtime connection failed: ${err.message}`,
      });
    });
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Send a transcript chunk for incremental analysis. */
  sendTranscript(text: string): void {
    this.socket?.emit("transcript", { text });
  }

  /** Tell the server the encounter is over; it responds with "final". */
  endEncounter(): void {
    this.socket?.emit("end");
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }
}
