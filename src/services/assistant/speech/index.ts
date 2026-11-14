/**
 * @file Speech provider factory
 * @description Resolves the configured speech-to-text provider once. Callers
 * import `getSpeechProvider()` and never name a concrete vendor — same seam as
 * the LLM provider factory.
 */

import { sttConfig } from '../../../config';
import { SpeechProvider } from './types';
import { OpenAITranscriptionProvider } from './OpenAITranscriptionProvider';

let provider: SpeechProvider | null = null;

export function getSpeechProvider(): SpeechProvider {
  if (provider) return provider;
  switch (sttConfig.provider) {
    case 'openai':
    default:
      provider = new OpenAITranscriptionProvider();
      break;
  }
  return provider;
}

export * from './types';
