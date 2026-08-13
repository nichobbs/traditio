import Anthropic from '@anthropic-ai/sdk';
import type { ApiClient, ApiConfig } from './types.js';

export class AnthropicClient implements ApiClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    const resolvedKey = (apiKey ?? process.env.ANTHROPIC_API_KEY)?.trim();
    this.client = new Anthropic({ apiKey: resolvedKey });
  }

  async callLearner(prompt: string, config: ApiConfig): Promise<string> {
    const message = await this.client.messages.create({
      model: config.model,
      max_tokens: config.maxOutputTokens,
      temperature: config.temperature,
      system: 'You are a participant in a language learning task. Follow the instructions exactly.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return content.text;
  }
}

export function createApiClient(apiKey?: string): ApiClient {
  return new AnthropicClient(apiKey);
}
