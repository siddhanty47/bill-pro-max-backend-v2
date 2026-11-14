/**
 * @file Provider-neutral speech-to-text types
 * @description Vendor-agnostic transcription shapes. The assistant speaks only
 * these types; each provider adapter (OpenAI Whisper today, …) maps them to its
 * own wire format. Mirrors the LLM provider seam so voice input is swappable too.
 */

/** Raw audio to transcribe (held in memory — never persisted). */
export interface TranscriptionInput {
  /** Audio bytes (e.g. a MediaRecorder blob). */
  buffer: Buffer;
  /** MIME type as reported by the uploader (e.g. "audio/webm"). */
  mimeType: string;
  /** Original filename, used only to hint the vendor at the container format. */
  filename?: string;
  /** Optional ISO-639-1 language hint (e.g. "en", "hi") to improve accuracy. */
  language?: string;
}

/** The transcription outcome. */
export interface TranscriptionResult {
  /** The recognized text (trimmed). */
  text: string;
}

/** A speech-to-text backend. */
export interface SpeechProvider {
  /** Stable provider name (for logs). */
  readonly name: string;
  /** True when the provider has the credentials it needs. */
  isEnabled(): boolean;
  /** Transcribe audio to text. Throws on failure. */
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}
