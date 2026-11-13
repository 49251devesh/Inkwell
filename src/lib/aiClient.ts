export type ClientAIProvider = 'gemini' | 'openrouter' | 'ollama' | 'offline';

export interface ProviderAISettings {
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

export interface AISettings {
  activeProvider: ClientAIProvider;
  providers: Record<ClientAIProvider, ProviderAISettings>;
}

const STORAGE_KEY = 'inkwell_ai_settings';
const DEFAULT_SETTINGS: AISettings = {
  activeProvider: 'offline',
  providers: {
    gemini: { apiKey: '', model: 'gemini-2.5-flash' },
    openrouter: { apiKey: '', model: '' },
    ollama: { apiKey: '', model: 'llama3.2', baseUrl: 'http://localhost:11434' },
    offline: { apiKey: '', model: 'offline-fallback' },
  },
};

function isProvider(value: unknown): value is ClientAIProvider {
  return value === 'gemini' || value === 'openrouter' || value === 'ollama' || value === 'offline';
}

function normalizeSettings(value: Partial<AISettings>): AISettings {
  const activeProvider = isProvider(value.activeProvider) ? value.activeProvider : 'offline';
  const incoming = (value.providers || {}) as Partial<Record<ClientAIProvider, ProviderAISettings>>;
  const providers = { ...DEFAULT_SETTINGS.providers } as AISettings['providers'];
  (Object.keys(providers) as ClientAIProvider[]).forEach((provider) => {
    const record = incoming[provider];
    if (record && typeof record === 'object') {
      providers[provider] = {
        ...providers[provider],
        ...record,
        apiKey: typeof record.apiKey === 'string' ? record.apiKey : providers[provider].apiKey,
        model: typeof record.model === 'string' ? record.model : providers[provider].model,
      };
    }
  });
  return { activeProvider, providers };
}

function migrateStoredSettings(raw: unknown): AISettings {
  if (!raw || typeof raw !== 'object') return normalizeSettings({});
  const candidate = raw as Partial<AISettings> & { provider?: ClientAIProvider; model?: string; apiKey?: string };
  if (candidate.providers && typeof candidate.providers === 'object') return normalizeSettings(candidate);

  // Previous releases stored one apiKey alongside the active provider/model.
  const migratedProvider = isProvider(candidate.provider)
    ? candidate.provider
    : candidate.apiKey
      ? 'gemini'
      : 'offline';
  const migrated = normalizeSettings({ activeProvider: migratedProvider });
  migrated.providers[migratedProvider] = {
    ...migrated.providers[migratedProvider],
    ...(typeof candidate.apiKey === 'string' ? { apiKey: candidate.apiKey } : {}),
    ...(typeof candidate.model === 'string' && candidate.model ? { model: candidate.model } : {}),
  };
  return migrated;
}

export function getAISettings(): AISettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const migrated = migrateStoredSettings(stored ? JSON.parse(stored) : null);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AISettings> & { apiKey?: string };
      if (parsed.apiKey !== undefined || !parsed.providers) saveAISettings(migrated);
    }
    return migrated;
  } catch {
    return normalizeSettings({});
  }
}

export function saveAISettings(settings: AISettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
  window.dispatchEvent(new Event('inkwell-ai-settings-changed'));
}

export function updateProviderSettings(provider: ClientAIProvider, patch: Partial<ProviderAISettings>) {
  const settings = getAISettings();
  saveAISettings({
    activeProvider: provider,
    providers: { ...settings.providers, [provider]: { ...settings.providers[provider], ...patch } },
  });
}

export function removeAIKey(provider = getAISettings().activeProvider) {
  const settings = getAISettings();
  saveAISettings({ activeProvider: settings.activeProvider, providers: { ...settings.providers, [provider]: { ...settings.providers[provider], apiKey: '' } } });
}

export function missingAIKeyMessage(provider: ClientAIProvider) {
  if (provider === 'openrouter') return 'Add your OpenRouter key in Settings > AI.';
  if (provider === 'gemini') return 'Add your Gemini key in Settings > AI.';
  return '';
}

export function getAIHeaders(options: { allowMissingKey?: boolean } = {}): Record<string, string> {
  return getAIHeadersForSettings(getAISettings(), options);
}

export function getAIHeadersForSettings(settings: AISettings, options: { allowMissingKey?: boolean } = {}): Record<string, string> {
  const provider = settings.activeProvider;
  const current = settings.providers[provider];
  if (!localStorage.getItem(STORAGE_KEY) || provider === 'offline' || provider === 'ollama') {
    return localStorage.getItem(STORAGE_KEY) ? { 'x-inkwell-ai-provider': provider, 'x-inkwell-ai-model': current.model } : {};
  }
  if (!current.apiKey && !options.allowMissingKey) throw new Error(missingAIKeyMessage(provider));
  const headers: Record<string, string> = { 'x-inkwell-ai-provider': provider, 'x-inkwell-ai-model': current.model };
  if (current.apiKey) headers['x-inkwell-ai-key'] = current.apiKey;
  return headers;
}

export function providerKeyLooksWrong(provider: ClientAIProvider, apiKey: string) {
  if (!apiKey || provider === 'ollama' || provider === 'offline') return null;
  if (provider === 'openrouter' && !apiKey.startsWith('sk-or-')) return 'This does not look like an OpenRouter key (usually starts with sk-or-).';
  if (provider === 'gemini' && !apiKey.startsWith('AIza')) return 'This does not look like a Google AI Studio key (usually starts with AIza).';
  return null;
}

export function providerLabel(provider: string, model: string) {
  const name = provider === 'openrouter' ? 'OpenRouter' : provider === 'ollama' ? 'Local Ollama' : provider === 'gemini' ? 'Gemini' : 'Offline fallback';
  return `${name} · ${model || 'default model'}`;
}
