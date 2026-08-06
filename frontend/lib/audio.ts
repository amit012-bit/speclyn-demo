/**
 * Microphone capture producing 16 kHz mono PCM16 chunks for streaming STT.
 *
 * MediaRecorder can only emit compressed containers (webm/opus), so raw PCM
 * requires the Web Audio path: getUserMedia -> AudioContext -> AudioWorklet.
 * The worklet (inlined below, loaded from a Blob URL so no static asset is
 * needed) forwards each render quantum of Float32 samples to the main
 * thread, which downsamples from the context sample rate (usually 48 kHz)
 * to 16 kHz with a simple linear-interpolation resampler, converts
 * Float32 -> Int16, and emits fixed ~50 ms chunks (800 samples = 1600
 * bytes) via the `onChunk` callback — the exact frame size AssemblyAI's
 * realtime endpoint expects.
 */

/** Thrown when the user denies microphone access (or capture is blocked). */
export class MicPermissionError extends Error {
  constructor(message = "Microphone permission denied") {
    super(message);
    this.name = "MicPermissionError";
  }
}

export type AudioChunkCallback = (chunk: ArrayBuffer) => void;

const TARGET_SAMPLE_RATE = 16_000;
/** 50 ms at 16 kHz — 800 Int16 samples = 1600 bytes per chunk. */
const CHUNK_SAMPLES = 800;
const WORKLET_NAME = "speclyn-pcm-capture";

/**
 * AudioWorkletProcessor source, inlined as a string and loaded via a Blob
 * URL. It runs on the audio rendering thread and simply posts a copy of
 * each mono Float32 render quantum (~128 frames) to the main thread —
 * resampling and Int16 conversion stay on the main thread where the
 * streaming socket lives.
 */
const WORKLET_SOURCE = `
class SpeclynPcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      // Copy — the engine reuses the underlying buffer between quanta.
      this.port.postMessage(channel.slice(0));
    }
    return true; // keep the processor alive until the node is disconnected
  }
}
registerProcessor("${WORKLET_NAME}", SpeclynPcmCaptureProcessor);
`;

/**
 * One-shot microphone capture session. `start(onChunk)` begins emitting
 * PCM16 chunks; `stop()` fully releases the mic track, audio graph, and
 * worklet. Instances are not reusable after `stop()` — create a new one.
 */
export class MicCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private workletUrl: string | null = null;
  private active = false;

  // Resampler carry-over between render quanta (continuity across buffers).
  private tail: Float32Array = new Float32Array(0);
  private readPos = 0;

  // Int16 accumulation until a full ~50 ms chunk is ready.
  private pcmBuffer = new Int16Array(CHUNK_SAMPLES);
  private pcmFill = 0;

  async start(onChunk: AudioChunkCallback): Promise<void> {
    if (this.active) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === "undefined"
    ) {
      throw new MicPermissionError(
        "Audio capture is not supported in this browser"
      );
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      // Permission denial (or a security block) is the typed, expected case.
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError")
      ) {
        throw new MicPermissionError();
      }
      throw new MicPermissionError(
        `Microphone unavailable: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    this.stream = stream;

    try {
      const context = new AudioContext();
      this.context = context;
      if (context.state === "suspended") await context.resume();

      const url = URL.createObjectURL(
        new Blob([WORKLET_SOURCE], { type: "application/javascript" })
      );
      this.workletUrl = url;
      await context.audioWorklet.addModule(url);

      const ratio = context.sampleRate / TARGET_SAMPLE_RATE;
      const node = new AudioWorkletNode(context, WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      this.workletNode = node;
      this.active = true;

      node.port.onmessage = (event: MessageEvent) => {
        if (!this.active) return;
        const samples = event.data as Float32Array;
        this.pushSamples(this.resample(samples, ratio), onChunk);
      };

      this.sourceNode = context.createMediaStreamSource(stream);
      this.sourceNode.connect(node);
      // Keep the graph pulled; the processor writes no output (silence).
      node.connect(context.destination);
    } catch (err) {
      this.stop();
      throw err instanceof Error
        ? err
        : new Error(`Audio capture setup failed: ${String(err)}`);
    }
  }

  /** Stop capturing and fully release the mic track and audio graph. */
  stop(): void {
    this.active = false;
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context && this.context.state !== "closed") {
      void this.context.close().catch(() => {
        // Already closing — nothing to release.
      });
    }
    this.context = null;
    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl);
      this.workletUrl = null;
    }
    this.tail = new Float32Array(0);
    this.readPos = 0;
    this.pcmFill = 0;
  }

  /**
   * Linear-interpolation downsampler. Keeps the unconsumed tail (plus the
   * fractional read position) between calls so resampling is continuous
   * across render quanta.
   */
  private resample(input: Float32Array, ratio: number): Float32Array {
    const merged = new Float32Array(this.tail.length + input.length);
    merged.set(this.tail, 0);
    merged.set(input, this.tail.length);

    const out: number[] = [];
    let pos = this.readPos;
    while (Math.floor(pos) + 1 < merged.length) {
      const idx = Math.floor(pos);
      const frac = pos - idx;
      out.push(merged[idx] + (merged[idx + 1] - merged[idx]) * frac);
      pos += ratio;
    }

    const keepFrom = Math.floor(pos);
    this.tail = merged.slice(keepFrom);
    this.readPos = pos - keepFrom;
    return Float32Array.from(out);
  }

  /** Float32 [-1, 1] -> Int16, buffered into fixed CHUNK_SAMPLES chunks. */
  private pushSamples(samples: Float32Array, onChunk: AudioChunkCallback): void {
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      this.pcmBuffer[this.pcmFill++] =
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      if (this.pcmFill === CHUNK_SAMPLES) {
        // Copy — the accumulation buffer is reused for the next chunk.
        onChunk(this.pcmBuffer.buffer.slice(0));
        this.pcmFill = 0;
      }
    }
  }
}
