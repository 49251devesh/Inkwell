import { GoogleGenAI } from '@google/genai';
import { errorFromStatus, normalizeAIError, timeoutSignal } from './errors';
import { AIProviderError } from './types';
import type { AIMessage, AIProvider, AIProviderId, AIRequestOptions } from './types';

const DEFAULT_TIMEOUT = 30_000;

function jsonSchema(schema: unknown) {
  return schema as Record<string, unknown>;
}

function geminiContents(messages: AIMessage[]) {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;
  constructor(public readonly model: string, private readonly defaultKey?: string) {}

  private client(opts: AIRequestOptions) {
    const apiKey = opts.apiKey || this.defaultKey;
    if (!apiKey) throw errorFromStatus(401, 'missing api key');
    return new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  }

  async *streamChat(messages: AIMessage[], opts: AIRequestOptions = {}) {
    const model = opts.model || this.model;
    opts.reportModel?.(this.id, model);
    try {
      const response = await this.client(opts).models.generateContentStream({ model, contents: geminiContents(messages) });
      for await (const chunk of response) if (chunk.text) yield chunk.text;
    } catch (error) {
      throw normalizeAIError(error);
    }
  }

  async generateJson<T>(prompt: string, schema: unknown, opts: AIRequestOptions = {}) {
    const model = opts.model || this.model;
    opts.reportModel?.(this.id, model);
    try {
      const response = await this.client(opts).models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: jsonSchema(schema) },
      });
      return JSON.parse(response.text || '{}') as T;
    } catch (error) {
      throw normalizeAIError(error);
    }
  }
}

type OpenRouterModel = { id: string };
type OpenRouterResponse = { choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }> };

export class OpenRouterProvider implements AIProvider {
  readonly id = 'openrouter' as const;
  constructor(
    public readonly model: string,
    private readonly defaultKey: string | undefined,
    private readonly models: () => Promise<string[]>
  ) {}

  private async candidates(opts: AIRequestOptions) {
    const available = await this.models();
    const selected = opts.model || this.model;
    const candidates = [selected, ...available.filter((model) => model !== selected)].filter(Boolean);
    if (!candidates.length) throw errorFromStatus(503, 'No free models available');
    return candidates;
  }

  private async request(model: string, body: Record<string, unknown>, opts: AIRequestOptions, stream: boolean) {
    const apiKey = opts.apiKey || this.defaultKey;
    if (!apiKey) throw errorFromStatus(401, 'missing api key');
    const baseUrl = (opts.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    const { signal, cleanup } = timeoutSignal(opts.timeoutMs || DEFAULT_TIMEOUT);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'Inkwell Atelier' },
        body: JSON.stringify({ ...body, model, stream }),
      });
      if (!response.ok) throw errorFromStatus(response.status, await response.text());
      return response;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw normalizeAIError(error);
    } finally {
      cleanup();
    }
  }

  async *streamChat(messages: AIMessage[], opts: AIRequestOptions = {}) {
    const models = await this.candidates(opts);
    let lastError: unknown;
    for (const model of models) {
      try {
        opts.reportModel?.(this.id, model);
        const response = await this.request(model, { messages }, opts, true);
        if (!response.body) throw new Error('Empty streaming response');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const data = line.trim().replace(/^data:\s*/, '');
            if (!data || data === '[DONE]') continue;
            const parsed = JSON.parse(data) as OpenRouterResponse;
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) yield text;
          }
        }
        return;
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || !('status' in error) || ![429, 500, 502, 503, 504].includes((error as { status?: number }).status || 0)) throw error;
      }
    }
    throw lastError || errorFromStatus(429);
  }

  async generateJson<T>(prompt: string, schema: unknown, opts: AIRequestOptions = {}) {
    const models = await this.candidates(opts);
    let lastError: unknown;
    for (const model of models) {
      try {
        opts.reportModel?.(this.id, model);
        const response = await this.request(model, {
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_schema', json_schema: { name: 'response', strict: true, schema } },
        }, opts, false);
        const parsed = (await response.json()) as OpenRouterResponse;
        return JSON.parse(parsed.choices?.[0]?.message?.content || '{}') as T;
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error) || !('status' in error) || ![429, 500, 502, 503, 504].includes((error as { status?: number }).status || 0)) throw error;
      }
    }
    throw lastError || errorFromStatus(429);
  }
}

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama' as const;
  constructor(public readonly model: string, private readonly baseUrl = 'http://localhost:11434') {}

  async *streamChat(messages: AIMessage[], opts: AIRequestOptions = {}) {
    const model = opts.model || this.model;
    opts.reportModel?.(this.id, model);
    const { signal, cleanup } = timeoutSignal(opts.timeoutMs || DEFAULT_TIMEOUT);
    try {
      const response = await fetch(`${(opts.baseUrl || this.baseUrl).replace(/\/$/, '')}/api/chat`, {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, stream: true }),
      });
      if (!response.ok) throw errorFromStatus(response.status, await response.text());
      if (!response.body) return;
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) { if (!line.trim()) continue; const parsed = JSON.parse(line) as { message?: { content?: string } }; if (parsed.message?.content) yield parsed.message.content; }
      }
    } catch (error) { throw error instanceof Error && error.name === 'AbortError' ? errorFromStatus(504) : normalizeAIError(error); }
    finally { cleanup(); }
  }

  async generateJson<T>(prompt: string, schema: unknown, opts: AIRequestOptions = {}) {
    const model = opts.model || this.model; opts.reportModel?.(this.id, model);
    const response = await fetch(`${(opts.baseUrl || this.baseUrl).replace(/\/$/, '')}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt, format: schema, stream: false }),
    });
    if (!response.ok) throw errorFromStatus(response.status, await response.text());
    return JSON.parse(((await response.json()) as { response: string }).response || '{}') as T;
  }
}

export class OfflineProvider implements AIProvider {
  readonly id = 'offline' as const;
  readonly model = 'offline-fallback';
  async *streamChat(_messages: AIMessage[], opts: AIRequestOptions = {}) { opts.reportModel?.(this.id, this.model); yield opts.offlineText || 'The offline atelier is ready, but no provider is configured.'; }
  async generateJson<T>(_prompt: string, _schema: unknown, opts: AIRequestOptions = {}) { opts.reportModel?.(this.id, this.model); return (opts.offlineJson || {}) as T; }
}
