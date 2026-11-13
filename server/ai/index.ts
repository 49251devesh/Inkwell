import { AIProviderError } from './types';
import { GeminiProvider, OllamaProvider, OfflineProvider, OpenRouterProvider } from './providers';
import type { AIProvider, AIProviderId } from './types';

let openRouterModels: { models: string[]; expiresAt: number } | null = null;

function isFreeModel(model: { id?: string; pricing?: { prompt?: string; completion?: string } }) {
  return Boolean(model.id?.endsWith(':free') || (Number(model.pricing?.prompt) === 0 && Number(model.pricing?.completion) === 0));
}

export async function getOpenRouterFreeModels(apiKey?: string) {
  if (openRouterModels && openRouterModels.expiresAt > Date.now()) return openRouterModels.models;
  const response = await fetch('https://openrouter.ai/api/v1/models', { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined });
  if (!response.ok) throw new AIProviderError('provider_unavailable', 'Could not load OpenRouter models.', response.status);
  const data = (await response.json()) as { data?: Array<{ id?: string; pricing?: { prompt?: string; completion?: string } }> };
  const models = (data.data || []).filter(isFreeModel).map((model) => model.id).filter((id): id is string => Boolean(id));
  openRouterModels = { models, expiresAt: Date.now() + 60 * 60 * 1000 };
  return models;
}

export function configuredProviderIds(): AIProviderId[] {
  const ids: AIProviderId[] = ['offline'];
  if (process.env.GEMINI_API_KEY) ids.unshift('gemini');
  if (process.env.OPENROUTER_API_KEY) ids.unshift('openrouter');
  if (process.env.OLLAMA_BASE_URL) ids.unshift('ollama');
  return ids;
}

export function createAIProvider(provider: AIProviderId | undefined, model?: string, apiKey?: string): AIProvider {
  if (provider === 'openrouter') return new OpenRouterProvider(model || '', process.env.OPENROUTER_API_KEY, () => getOpenRouterFreeModels(apiKey || process.env.OPENROUTER_API_KEY));
  if (provider === 'ollama') return new OllamaProvider(model || process.env.OLLAMA_MODEL || 'llama3.2', process.env.OLLAMA_BASE_URL || 'http://localhost:11434');
  if (provider === 'gemini') return new GeminiProvider(model || process.env.GEMINI_MODEL || 'gemini-2.5-flash', process.env.GEMINI_API_KEY);
  if (!provider) {
    if (process.env.GEMINI_API_KEY) return new GeminiProvider(model || process.env.GEMINI_MODEL || 'gemini-2.5-flash', process.env.GEMINI_API_KEY);
    if (process.env.OPENROUTER_API_KEY) return new OpenRouterProvider(model || '', process.env.OPENROUTER_API_KEY, () => getOpenRouterFreeModels(process.env.OPENROUTER_API_KEY));
  }
  return new OfflineProvider();
}

export { AIProviderError } from './types';
export type { AIMessage, AIProvider, AIProviderId, AIProviderMeta } from './types';
