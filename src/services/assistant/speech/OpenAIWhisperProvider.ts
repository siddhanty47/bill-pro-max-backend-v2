/**
 * @file OpenAIWhisperProvider
 * @description Speech-to-text via OpenAI's audio transcription endpoint (Whisper).
 * Reuses the same OPENAI_API_KEY as the embeddings feature. Audio is streamed
 * straight from the in-memory upload buffer — nothing is written to disk or Mongo.
 */

import OpenAI, { toFile } from 'openai';
import { sttConfig } from '../../../config';
import { logger } from '../../../utils/logger';
import { SpeechProvider, TranscriptionInput, TranscriptionResult } from './types';

export class OpenAIWhisperProvider implements SpeechProvider {
  readonly name = 'openai-whisper';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: sttConfig.apiKey || 'not-configured' });
  }

  isEnabled(): boolean {
    return !!sttConfig.apiKey;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    // The SDK needs a File-like object; `toFile` wraps the buffer with a name +
    // content type so the vendor can infer the audio container.
    const file = await toFile(input.buffer, input.filename || 'audio.webm', {
      type: input.mimeType || 'audio/webm',
    });

    logger.info('Assistant transcribe (whisper)', {
      model: sttConfig.model,
      bytes: input.buffer.length,
      mimeType: input.mimeType,
    });

    const result = await this.client.audio.transcriptions.create({
      file,
      model: sttConfig.model,
      language: input.language,
      response_format: 'text',
    });

    // With response_format 'text' the SDK returns the raw string.
    const text = (typeof result === 'string' ? result : (result as { text?: string }).text || '').trim();
    return { text };
  }
}
