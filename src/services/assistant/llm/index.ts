/**
 * @file LLM provider factory
 * @description Resolves the configured provider once. The agentic loop imports
 * `getLLMProvider()` and never names a concrete vendor.
 */

import { assistantConfig } from '../../../config';
import { LLMProvider } from './LLMProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { OpenAIProvider } from './OpenAIProvider';

let provider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (provider) return provider;
  switch (assistantConfig.provider) {
    case 'openai':
      provider = new OpenAIProvider();
      break;
    case 'anthropic':
    default:
      provider = new AnthropicProvider();
      break;
  }
  return provider;
}

export * from './types';
export { LLMProvider } from './LLMProvider';
