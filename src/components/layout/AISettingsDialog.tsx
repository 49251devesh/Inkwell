import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Loader2, Settings2, Trash2, X } from 'lucide-react';
import { getAIHeaders, getAISettings, providerLabel, saveAISettings, type AISettings, type ClientAIProvider } from '../../lib/aiClient';

interface AISettingsDialogProps { open: boolean; onClose: () => void; }

const PROVIDERS: Array<{ id: ClientAIProvider; label: string }> = [
  { id: 'gemini', label: 'Gemini' }, { id: 'openrouter', label: 'OpenRouter free' }, { id: 'ollama', label: 'Local Ollama' }, { id: 'offline', label: 'Offline fallback' },
];

export const AISettingsDialog: React.FC<AISettingsDialogProps> = ({ open, onClose }) => {
  const [settings, setSettings] = useState<AISettings>(getAISettings);
  const [models, setModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const maskedKey = useMemo(() => settings.apiKey ? `${settings.apiKey.slice(0, 4)}${'•'.repeat(Math.max(6, Math.min(18, settings.apiKey.length - 4)))}` : '', [settings.apiKey]);

  useEffect(() => {
    if (!open) return;
    setSettings(getAISettings()); setMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open || settings.provider === 'offline') { setModels(['offline-fallback']); return; }
    let cancelled = false;
    setLoadingModels(true);
    fetch(`/api/ai/models?provider=${settings.provider}`, { headers: getAIHeaders() })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load models.'); return data.models as string[]; })
      .then((nextModels) => { if (!cancelled) { setModels(nextModels); if (nextModels.length && !nextModels.includes(settings.model)) setSettings((current) => ({ ...current, model: nextModels[0] })); } })
      .catch((error) => { if (!cancelled) { setModels([]); setMessage({ text: error.message, ok: false }); } })
      .finally(() => { if (!cancelled) setLoadingModels(false); });
    return () => { cancelled = true; };
  }, [open, settings.provider, settings.apiKey]);

  if (!open) return null;
  const update = (patch: Partial<AISettings>) => setSettings((current) => ({ ...current, ...patch }));
  const save = () => { saveAISettings(settings); setMessage({ text: `Using ${providerLabel(settings.provider, settings.model)}.`, ok: true }); };
  const test = async () => {
    setTesting(true); setMessage(null); saveAISettings(settings);
    try {
      const response = await fetch('/api/ai/test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAIHeaders() }, body: JSON.stringify({ provider: settings.provider, model: settings.model }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The connection could not be tested.');
      setMessage({ text: `Connection held: ${providerLabel(data.provider, data.model)}.`, ok: true });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : 'The connection could not be tested.', ok: false }); }
    finally { setTesting(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="AI settings">
    <button type="button" aria-label="Close settings" onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" />
    <section className="relative z-10 w-full max-w-lg paper-folio border p-6 sm:p-8 space-y-5" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-brass)' }}>
      <div className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-hairline)' }}>
        <div><span className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>Settings · AI</span><h2 className="font-display text-2xl mt-1" style={{ color: 'var(--text-primary)' }}>Choose your atelier provider</h2></div>
        <button type="button" onClick={onClose} aria-label="Close AI settings" className="p-1" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
      </div>
      <div className="space-y-4">
        <label className="block"><span className="small-caps-meta text-xs" style={{ color: 'var(--text-secondary)' }}>Provider</span><select value={settings.provider} onChange={(e) => update({ provider: e.target.value as ClientAIProvider, model: e.target.value === 'offline' ? 'offline-fallback' : '' })} className="mt-1 w-full border p-2.5 bg-transparent font-manuscript" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}>{PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
        <label className="block"><span className="small-caps-meta text-xs" style={{ color: 'var(--text-secondary)' }}>Model</span><select value={settings.model} onChange={(e) => update({ model: e.target.value })} disabled={loadingModels || !models.length} className="mt-1 w-full border p-2.5 bg-transparent font-manuscript" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}>{models.map((model) => <option key={model} value={model}>{model}</option>)}{!models.length && <option value={settings.model}>{loadingModels ? 'Loading models…' : 'No models available'}</option>}</select>{settings.provider === 'openrouter' && <span className="mt-1 block text-xs font-manuscript italic" style={{ color: 'var(--text-muted)' }}>Free models are loaded from OpenRouter at runtime and refreshed hourly.</span>}</label>
        {settings.provider !== 'offline' && <div><label className="block"><span className="small-caps-meta text-xs" style={{ color: 'var(--text-secondary)' }}>Your API key <span style={{ color: 'var(--text-muted)' }}>(optional)</span></span><div className="mt-1 flex border" style={{ borderColor: 'var(--border-hairline)' }}><input type={showKey ? 'text' : 'password'} value={showKey ? settings.apiKey : (settings.apiKey ? maskedKey : '')} onChange={(e) => update({ apiKey: e.target.value })} placeholder="Paste a key to use it for this browser" className="min-w-0 flex-1 bg-transparent p-2.5 font-mono text-xs outline-none" style={{ color: 'var(--text-primary)' }} /><button type="button" onClick={() => setShowKey((value) => !value)} className="px-2" aria-label={showKey ? 'Hide key' : 'Show key'} style={{ color: 'var(--text-muted)' }}>{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></label>{settings.apiKey && <button type="button" onClick={() => update({ apiKey: '' })} className="mt-2 inline-flex items-center gap-1 text-xs font-manuscript" style={{ color: 'var(--accent-primary)' }}><Trash2 className="w-3 h-3" />Remove key</button>}<button type="button" onClick={() => setShowSafety((value) => !value)} className="mt-2 block text-xs font-manuscript underline" style={{ color: 'var(--text-secondary)' }}>Why is this safe?</button>{showSafety && <p className="mt-2 text-xs leading-relaxed font-manuscript" style={{ color: 'var(--text-muted)' }}>The key is stored only in this browser's localStorage, sent to your selected provider over the request header, never logged or persisted by Inkwell, and never echoed in responses. Remove it any time.</p>}</div>}
      </div>
      {message && <p className="flex items-center gap-2 text-sm font-manuscript" style={{ color: message.ok ? 'var(--accent-brass)' : 'var(--accent-primary)' }}>{message.ok && <Check className="w-4 h-4" />}{message.text}</p>}
      <div className="flex items-center justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--border-hairline)' }}><button type="button" onClick={test} disabled={testing || loadingModels} className="inline-flex items-center gap-2 px-3 py-2 border text-sm font-manuscript" style={{ borderColor: 'var(--border-brass)', color: 'var(--text-primary)' }}>{testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}Test connection</button><button type="button" onClick={save} className="px-4 py-2 text-sm font-manuscript" style={{ backgroundColor: 'var(--accent-primary)', color: '#F4EFE5' }}>Save settings</button></div>
    </section>
  </div>;
};
