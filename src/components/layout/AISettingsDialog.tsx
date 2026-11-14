import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Loader2, Settings2, Trash2, X } from 'lucide-react';
import {
  getAIHeaders,
  getAIHeadersForSettings,
  getAISettings,
  missingAIKeyMessage,
  providerKeyLooksWrong,
  providerLabel,
  saveAISettings,
  type AISettings,
  type ClientAIProvider,
} from '../../lib/aiClient';

interface AISettingsDialogProps { open: boolean; onClose: () => void; }

const PROVIDERS: Array<{ id: ClientAIProvider; label: string }> = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'openrouter', label: 'OpenRouter free' },
  { id: 'ollama', label: 'Local Ollama' },
  { id: 'offline', label: 'Offline fallback' },
];

export const AISettingsDialog: React.FC<AISettingsDialogProps> = ({ open, onClose }) => {
  const [settings, setSettings] = useState<AISettings>(getAISettings);
  const [models, setModels] = useState<string[]>([]);
  const [editingKey, setEditingKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [allowKeyWarning, setAllowKeyWarning] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const provider = settings.activeProvider;
  const current = settings.providers[provider];
  const keyWarning = providerKeyLooksWrong(provider, current.apiKey || '');
  const maskedKey = useMemo(
    () => current.apiKey ? `••••••••${current.apiKey.slice(-4)}` : '',
    [current.apiKey]
  );

  useEffect(() => {
    if (!open) return;
    setSettings(getAISettings());
    setEditingKey(false);
    setShowKey(false);
    setAllowKeyWarning(false);
    setMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open || provider === 'offline') {
      setModels(['offline-fallback']);
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    fetch(`/api/ai/models?provider=${provider}`, { headers: getAIHeadersForSettings(settings, { allowMissingKey: true }) })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load models.');
        return data.models as string[];
      })
      .then((nextModels) => {
        if (!cancelled) {
          setModels(nextModels);
          if (nextModels.length && !nextModels.includes(current.model)) {
            setSettings((value) => ({
              ...value,
              providers: { ...value.providers, [provider]: { ...value.providers[provider], model: nextModels[0] } },
            }));
          }
        }
      })
      .catch((error) => { if (!cancelled) { setModels([]); setMessage({ text: error.message, ok: false }); } })
      .finally(() => { if (!cancelled) setLoadingModels(false); });
    return () => { cancelled = true; };
  }, [open, provider]);

  if (!open) return null;

  const updateProvider = (patch: Partial<AISettings['providers'][ClientAIProvider]>) => {
    setSettings((value) => ({
      ...value,
      providers: { ...value.providers, [provider]: { ...value.providers[provider], ...patch } },
    }));
  };

  const handleProviderChange = (nextProvider: ClientAIProvider) => {
    setSettings((value) => ({ ...value, activeProvider: nextProvider }));
    setEditingKey(false);
    setShowKey(false);
    setAllowKeyWarning(false);
    setMessage(null);
  };

  const save = () => {
    if (keyWarning && !allowKeyWarning) {
      setMessage({ text: `${keyWarning} Choose “Use anyway” if it is intentional.`, ok: false });
      return;
    }
    saveAISettings(settings);
    setEditingKey(false);
    setShowKey(false);
    setMessage({ text: `Using ${providerLabel(provider, current.model)}.`, ok: true });
  };

  const removeKey = () => {
    const nextSettings: AISettings = {
      ...settings,
      providers: { ...settings.providers, [provider]: { ...settings.providers[provider], apiKey: '' } },
    };
    setSettings(nextSettings);
    saveAISettings(nextSettings);
    setEditingKey(true);
    setShowKey(false);
    setAllowKeyWarning(false);
    setMessage({ text: `${PROVIDERS.find((item) => item.id === provider)?.label} key removed.`, ok: true });
  };

  const test = async () => {
    if ((provider === 'gemini' || provider === 'openrouter') && !current.apiKey) {
      setMessage({ text: missingAIKeyMessage(provider), ok: false });
      return;
    }
    if (keyWarning && !allowKeyWarning) {
      setMessage({ text: `${keyWarning} Choose “Use anyway” before testing.`, ok: false });
      return;
    }
    setTesting(true);
    setMessage(null);
    saveAISettings(settings);
    try {
      const response = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAIHeaders() },
        body: JSON.stringify({ provider, model: current.model }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The connection could not be tested.');
      setMessage({ text: `Connection held: ${providerLabel(data.provider, data.model)}.`, ok: true });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'The connection could not be tested.', ok: false });
    } finally {
      setTesting(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="AI settings">
    <button type="button" aria-label="Close settings" onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" />
    <section className="relative z-10 w-full max-w-lg paper-folio border p-6 sm:p-8 space-y-5" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-brass)' }}>
      <div className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-hairline)' }}>
        <div><span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>Settings · AI</span><h2 className="font-display text-2xl mt-1" style={{ color: 'var(--text-primary)' }}>Choose your atelier provider</h2></div>
        <button type="button" onClick={onClose} aria-label="Close AI settings" className="p-1" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
      </div>
      <div className="space-y-4">
        <label className="block"><span className="small-caps-meta text-xs" style={{ color: 'var(--text-secondary)' }}>Provider</span><select value={provider} onChange={(event) => handleProviderChange(event.target.value as ClientAIProvider)} className="mt-1 w-full border p-2.5 bg-transparent font-manuscript" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}>{PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.label}{settings.providers[item.id].apiKey ? ' · Key saved' : ''}</option>)}</select><span className="mt-1 block text-xs font-manuscript" style={{ color: current.apiKey ? 'var(--accent-brass)' : 'var(--text-muted)' }}>{current.apiKey ? `${PROVIDERS.find((item) => item.id === provider)?.label} key saved` : `No ${PROVIDERS.find((item) => item.id === provider)?.label} key saved`}</span></label>
        <label className="block"><span className="small-caps-meta text-xs" style={{ color: 'var(--text-secondary)' }}>Model</span><select value={current.model} onChange={(event) => updateProvider({ model: event.target.value })} disabled={loadingModels || !models.length} className="mt-1 w-full border p-2.5 bg-transparent font-manuscript" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}>{models.map((model) => <option key={model} value={model}>{model}</option>)}{!models.length && <option value={current.model}>{loadingModels ? 'Loading models…' : 'No models available'}</option>}</select>{provider === 'openrouter' && <span className="mt-1 block text-xs font-manuscript italic" style={{ color: 'var(--text-muted)' }}>Free models are loaded from OpenRouter at runtime and refreshed hourly.</span>}</label>
        {provider === 'ollama' && <label className="block"><span className="small-caps-meta text-xs" style={{ color: 'var(--text-secondary)' }}>Ollama base URL</span><input value={current.baseUrl || ''} onChange={(event) => updateProvider({ baseUrl: event.target.value })} className="mt-1 w-full border p-2.5 bg-transparent font-mono text-xs" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }} /></label>}
        {(provider === 'gemini' || provider === 'openrouter') && <div><label className="block"><span className="small-caps-meta text-xs" style={{ color: 'var(--text-secondary)' }}>Your API key</span><div className="mt-1 flex border" style={{ borderColor: 'var(--border-hairline)' }}><input type={showKey ? 'text' : 'password'} value={editingKey ? (showKey ? current.apiKey || '' : current.apiKey || '') : maskedKey} readOnly={!editingKey && Boolean(current.apiKey)} onChange={(event) => { updateProvider({ apiKey: event.target.value }); setAllowKeyWarning(false); }} placeholder={`Paste your ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} key`} className="min-w-0 flex-1 bg-transparent p-2.5 font-mono text-xs outline-none" style={{ color: 'var(--text-primary)' }} /><button type="button" onClick={() => setShowKey((value) => !value)} className="px-2" aria-label={showKey ? 'Hide key' : 'Show key'} style={{ color: 'var(--text-muted)' }}>{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></label><div className="mt-2 flex items-center gap-3 text-xs font-manuscript"><span style={{ color: current.apiKey ? 'var(--accent-brass)' : 'var(--text-muted)' }}>{current.apiKey ? 'Key saved' : 'No key saved'}</span>{current.apiKey && <button type="button" onClick={() => { setEditingKey(true); setShowKey(true); }} className="underline" style={{ color: 'var(--text-secondary)' }}>Replace</button>}{current.apiKey && <button type="button" onClick={removeKey} className="inline-flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}><Trash2 className="w-3 h-3" />Remove</button>}</div>{keyWarning && <div className="mt-2 text-xs font-manuscript" style={{ color: 'var(--accent-primary)' }}>{keyWarning} <button type="button" onClick={() => setAllowKeyWarning(true)} className="ml-1 underline" style={{ color: 'var(--text-primary)' }}>Use anyway</button></div>}<button type="button" onClick={() => setShowSafety((value) => !value)} className="mt-2 block text-xs font-manuscript underline" style={{ color: 'var(--text-secondary)' }}>Why is this safe?</button>{showSafety && <p className="mt-2 text-xs leading-relaxed font-manuscript" style={{ color: 'var(--text-muted)' }}>The key is stored only in this browser’s localStorage, sent to the selected provider over the request header, never logged or persisted by Inkwell, and never echoed in responses.</p>}</div>}
      </div>
      {message && <p className="flex items-center gap-2 text-sm font-manuscript" style={{ color: message.ok ? 'var(--accent-brass)' : 'var(--accent-primary)' }}>{message.ok && <Check className="w-4 h-4" />}{message.text}</p>}
      <div className="flex items-center justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--border-hairline)' }}><button type="button" onClick={test} disabled={testing || loadingModels} className="inline-flex items-center gap-2 px-3 py-2 border text-sm font-manuscript" style={{ borderColor: 'var(--border-brass)', color: 'var(--text-primary)' }}>{testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}Test connection</button><button type="button" onClick={save} className="px-4 py-2 text-sm font-manuscript" style={{ backgroundColor: 'var(--accent-primary)', color: '#F4EFE5' }}>Save settings</button></div>
    </section>
  </div>;
};
