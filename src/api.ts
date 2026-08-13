import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';
import type { ApiClient, ApiConfig } from './types.js';

const LEARNER_SYSTEM_PROMPT =
  'You are a participant in a language learning task. Follow the instructions exactly.';

// Valid HTTP header values are restricted to \t and \x20-\xff (see node-fetch's validateValue).
// Report where an offending character is, without ever logging the key itself.
function diagnoseHeaderValue(value: string): void {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const isValid = code === 0x09 || (code >= 0x20 && code <= 0xff);
    if (!isValid) {
      console.error(
        `ANTHROPIC_API_KEY contains an invalid character for an HTTP header at index ${i} (char code 0x${code.toString(16)}). ` +
          `Key length is ${value.length}. This usually means the secret was pasted with an embedded newline or extra text. ` +
          `Re-copy the key from the Anthropic console and update the secret with no extra whitespace or line breaks.`
      );
    }
  }
}

export class AnthropicClient implements ApiClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    // A raw API key can never legitimately contain CR/LF - strip them wherever
    // they appear (not just at the edges) to tolerate secrets pasted with an
    // embedded line break, then trim any remaining edge whitespace.
    const resolvedKey = (apiKey ?? process.env.ANTHROPIC_API_KEY)?.replace(/[\r\n]/g, '').trim();
    if (resolvedKey) {
      diagnoseHeaderValue(resolvedKey);
    }
    this.client = new Anthropic({ apiKey: resolvedKey });
  }

  async callLearner(prompt: string, config: ApiConfig): Promise<string> {
    const message = await this.client.messages.create({
      model: config.model,
      max_tokens: config.maxOutputTokens,
      temperature: config.temperature,
      system: LEARNER_SYSTEM_PROMPT,
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

const CLI_TIMEOUT_MS = 3 * 60 * 1000;

// Uses the Claude Code CLI in headless mode, authenticated via a
// CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) so calls are billed
// against a Claude Pro/Max subscription instead of metered API usage.
// --bare is deliberately omitted: bare mode only supports API-key auth and
// ignores CLAUDE_CODE_OAUTH_TOKEN entirely, which surfaces as "Not logged in".
// The prompt is piped via stdin rather than passed as a positional argument
// to `-p`, since -p greedily consumes any trailing argv entries (including
// subsequent flags) into the prompt value if given one inline.
export class ClaudeCliClient implements ApiClient {
  async callLearner(prompt: string, config: ApiConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('claude', [
        '--model',
        config.model,
        '--output-format',
        'json',
        '--system-prompt',
        LEARNER_SYSTEM_PROMPT,
        '--permission-mode',
        'dontAsk',
        '-p',
      ]);

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(
          new Error(
            `claude CLI timed out after ${CLI_TIMEOUT_MS}ms. stdout so far: ${stdout.slice(0, 500)} stderr so far: ${stderr.slice(0, 500)}`
          )
        );
      }, CLI_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(err);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(`claude CLI exited with code ${code}: ${stderr || stdout}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          if (typeof parsed.result !== 'string') {
            reject(new Error(`Unexpected claude CLI output: missing result field: ${stdout.slice(0, 500)}`));
            return;
          }
          resolve(parsed.result);
        } catch {
          reject(new Error(`Failed to parse claude CLI output as JSON: ${stdout.slice(0, 500)}`));
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}

export function createApiClient(apiKey?: string): ApiClient {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return new ClaudeCliClient();
  }
  return new AnthropicClient(apiKey);
}
