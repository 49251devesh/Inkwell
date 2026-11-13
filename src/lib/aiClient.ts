export type ClientAIProvider = 'gemini' | 'openrouter' | 'ollama' | 'offline';

export interface AISettings {
  provider: ClientAIProvider;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = 'inkwell_ai_settings';

export function getAISettings(): AISettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<AISettings>;
    return {
      provider: parsed.provider || 'offline',
      model: parsed.model || 'offline-fallback',
      apiKey: parsed.apiKey || '',
    };
  } catch {
    return { provider: 'offline', model: 'offline-fallback', apiKey: '' };
  }
}

export function saveAISettings(settings: AISettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event('inkwell-ai-settings-changed'));
}

export function removeAIKey() {
  const settings = getAISettings();
  saveAISettings({ ...settings, apiKey: '' });
}

export function getAIHeaders(): Record<string, string> {
  if (!localStorage.getItem(STORAGE_KEY)) return {};
  const settings = getAISettings();
  const headers: Record<string, string> = {
    'x-inkwell-ai-provider': settings.provider,
    'x-inkwell-ai-model': settings.model,
  };
  if (settings.apiKey) headers['x-inkwell-ai-key'] = settings.apiKey;
  return headers;
}

export function providerLabel(provider: string, model: string) {
  const name = provider === 'openrouter' ? 'OpenRouter' : provider === 'ollama' ? 'Local Ollama' : provider === 'gemini' ? 'Gemini' : 'Offline fallback';
  return `${name} · ${model || 'default model'}`;
}
