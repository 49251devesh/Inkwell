export type AIProviderId = 'gemini' | 'openrouter' | 'ollama' | 'offline';

export type AIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AIRequestOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  offlineText?: string;
  offlineJson?: unknown;
  reportModel?: (provider: AIProviderId, model: string) => void;
};

export type AIProviderMeta = {
  provider: AIProviderId;
  model: string;
};

export type AIErrorCode = 'bad_key' | 'rate_limit' | 'model_unavailable' | 'timeout' | 'provider_unavailable';

export class AIProviderError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly model: string;
  streamChat(messages: AIMessage[], opts?: AIRequestOptions): AsyncIterable<string>;
  generateJson<T>(prompt: string, schema: unknown, opts?: AIRequestOptions): Promise<T>;
}
