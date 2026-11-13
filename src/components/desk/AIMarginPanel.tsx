import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpenCheck,
  Check,
  Copy,
  Eye,
  Feather,
  Lightbulb,
  PenTool,
  RefreshCw,
  Scissors,
  Sparkles,
  X,
  PlusCircle,
  Replace,
} from 'lucide-react';
import {
  AI_ACTIONS,
  AIActionType,
  AIResponse,
  providerLabel,
  requestAIAssistance,
} from '../../lib/aiService';
import { CornerOrnament, FleuronDivider } from '../ornaments/Ornaments';
import { useToast } from '../../hooks/useToast';

interface AIMarginPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  contextText: string;
  chapterTitle: string;
  projectTitle: string;
  projectGenre: string;
  onInsertText: (text: string) => void;
  onReplaceText: (replacement: string) => void;
}

export const AIMarginPanel: React.FC<AIMarginPanelProps> = ({
  isOpen,
  onClose,
  selectedText,
  contextText,
  chapterTitle,
  projectTitle,
  projectGenre,
  onInsertText,
  onReplaceText,
}) => {
  const { notify } = useToast();
  const [loadingAction, setLoadingAction] = useState<AIActionType | null>(null);
  const [currentResponse, setCurrentResponse] = useState<AIResponse | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  const getActionIcon = (actionId: AIActionType) => {
    switch (actionId) {
      case 'continue':
        return <PenTool className="w-3.5 h-3.5" strokeWidth={1.5} />;
      case 'rewrite':
        return <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />;
      case 'tighten':
        return <Scissors className="w-3.5 h-3.5" strokeWidth={1.5} />;
      case 'describe':
        return <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />;
      case 'brainstorm':
        return <Lightbulb className="w-3.5 h-3.5" strokeWidth={1.5} />;
      case 'critique':
        return <BookOpenCheck className="w-3.5 h-3.5" strokeWidth={1.5} />;
    }
  };

  const handleExecuteAction = async (action: AIActionType) => {
    setLoadingAction(action);
    try {
      const resp = await requestAIAssistance({
        action,
        selectedText,
        contextText,
        chapterTitle,
        projectTitle,
        projectGenre,
        customPrompt: customPrompt.trim() || undefined,
      });
      setCurrentResponse(resp);
    } catch {
      notify('Atelier Busy', 'Could not draft margin note. Please try again.', 'warning');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCopy = () => {
    if (!currentResponse) return;
    navigator.clipboard.writeText(currentResponse.output);
    setCopied(true);
    notify('Copied to Clipboard', 'Margin note copied to your clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (!currentResponse) return;
    onInsertText(currentResponse.output);
    notify('Inked to Folio', 'Suggestion inserted into the manuscript.');
  };

  const handleReplace = () => {
    if (!currentResponse || !selectedText) return;
    onReplaceText(currentResponse.output);
    notify('Passage Recast', 'Selected text replaced with the revision.');
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            style={{ zIndex: 99990 }}
          />

          {/* Margin Panel Sliding from Right */}
          <motion.aside
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-label="AI Margin Notes Panel"
            className="fixed top-0 bottom-0 right-0 w-full sm:w-[420px] md:w-[440px] border-l flex flex-col shadow-2xl overflow-hidden"
            style={{
              zIndex: 99999,
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-brass)',
              boxShadow: 'var(--shadow-stacked)',
            }}
          >
            <CornerOrnament position="tr" />
            <CornerOrnament position="br" />

            {/* Panel Header */}
            <div
              className="p-5 sm:p-6 pb-4 border-b relative"
              style={{
                borderColor: 'var(--border-hairline)',
                backgroundColor: 'var(--bg-canvas)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="p-1.5 rounded-sm border"
                    style={{
                      borderColor: 'var(--border-brass)',
                      backgroundColor: 'var(--burgundy-wash)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    <Feather className="w-4 h-4" strokeWidth={1.4} />
                  </span>
                  <div>
                    <p className="small-caps-meta text-xs" style={{ color: 'var(--accent-brass)' }}>
                      Atelier Assistant · Scholia
                    </p>
                    <h2
                      className="font-display text-lg font-medium leading-tight mt-0.5"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Margin Notes
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close margin notes panel"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-manuscript rounded border transition-colors cursor-pointer hover:bg-[var(--burgundy-wash)] focus-visible:outline-2"
                  style={{
                    borderColor: 'var(--border-brass)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="font-medium text-xs">Close</span>
                </button>
              </div>

              {/* Context Tag: selection vs whole chapter */}
              <div
                className="mt-3.5 py-1.5 px-3 rounded-sm text-xs flex items-center justify-between gap-2"
                style={{
                  backgroundColor: 'var(--bg-recessed)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <span className="font-manuscript truncate">
                  {selectedText
                    ? `Passage selected: “${selectedText.slice(0, 36).trim()}…”`
                    : `Active folio: ${chapterTitle}`}
                </span>
                <span className="font-mono-tabular text-[10px] shrink-0" style={{ color: 'var(--accent-brass)' }}>
                  {selectedText ? 'Selection' : 'Chapter'}
                </span>
              </div>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {/* Actions Grid */}
              <div>
                <span className="small-caps-meta text-xs block mb-2.5" style={{ color: 'var(--text-muted)' }}>
                  Atelier Directives
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {AI_ACTIONS.map((action) => {
                    const isBusy = loadingAction === action.id;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => handleExecuteAction(action.id)}
                        disabled={loadingAction !== null}
                        className="p-2.5 border rounded-sm text-left transition-all duration-200 cursor-pointer hover:border-[var(--accent-brass)] hover:bg-[var(--burgundy-wash)] disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--bg-canvas)',
                          borderColor: 'var(--border-hairline)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="text-xs"
                            style={{ color: 'var(--accent-primary)' }}
                          >
                            {getActionIcon(action.id)}
                          </span>
                          <span className="font-mono-tabular text-[10px] opacity-60">
                            {action.latinTag}
                          </span>
                        </div>
                        <p className="font-display text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                          {isBusy ? 'Inking…' : action.label}
                        </p>
                        <p className="text-[11px] font-manuscript leading-tight mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                          {action.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inking / Loading animation */}
              {loadingAction && (
                <div
                  className="p-5 border rounded-sm text-center space-y-2"
                  style={{
                    backgroundColor: 'var(--burgundy-wash)',
                    borderColor: 'var(--border-brass)',
                  }}
                >
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  <p className="font-display text-sm italic" style={{ color: 'var(--text-primary)' }}>
                    Inking response on margin folio…
                  </p>
                </div>
              )}

              {/* Latest AI Response Card */}
              {currentResponse && !loadingAction && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="paper-card p-4 sm:p-5 border relative"
                  style={{
                    borderColor: 'var(--border-brass)',
                    backgroundColor: 'var(--bg-canvas)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono-tabular rounded-sm border"
                        style={{
                          backgroundColor: 'var(--burgundy-wash)',
                          borderColor: 'var(--accent-primary)',
                          color: 'var(--accent-primary)',
                          fontWeight: 600,
                        }}
                      >
                        {providerLabel(currentResponse.provider, currentResponse.model)}
                      </span>
                      <span className="text-xs font-mono-tabular text-stone-500">
                        · {currentResponse.timestamp}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentResponse(null)}
                      title="Clear margin note"
                      className="p-1 hover:opacity-75 transition-opacity"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3
                    className="font-display text-base font-medium mt-3"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {currentResponse.headline}
                  </h3>

                  <div className="mt-2.5 manuscript-ruled py-1">
                    <p
                      className="text-[15px] sm:text-[16px] leading-relaxed font-manuscript whitespace-pre-line"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {currentResponse.output}
                    </p>
                  </div>

                  {/* Bullet points if critique / brainstorm */}
                  {currentResponse.critiquePoints && currentResponse.critiquePoints.length > 0 && (
                    <ul className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'var(--border-hairline)' }}>
                      {currentResponse.critiquePoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs font-manuscript">
                          <span style={{ color: 'var(--accent-brass)' }}>❦</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Actions on response */}
                  <div
                    className="mt-4 pt-3 border-t flex flex-wrap items-center justify-end gap-2"
                    style={{ borderColor: 'var(--border-hairline)' }}
                  >
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-2.5 py-1 text-xs font-manuscript rounded-sm border inline-flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity"
                      style={{
                        borderColor: 'var(--border-hairline)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>

                    {selectedText && (
                      <button
                        type="button"
                        onClick={handleReplace}
                        className="px-3 py-1 text-xs font-manuscript rounded-sm border inline-flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity"
                        style={{
                          borderColor: 'var(--accent-brass)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Replace className="w-3 h-3" />
                        <span>Replace Selection</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleInsert}
                      className="px-3 py-1 text-xs font-manuscript rounded-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: '#F4EFE5',
                      }}
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>Insert into Folio</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Freeform Prompt input */}
              <div
                className="pt-4 border-t"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                <label
                  htmlFor="ai-custom-prompt"
                  className="block small-caps-meta text-xs mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Custom Marginal Query
                </label>
                <div className="flex gap-2">
                  <input
                    id="ai-custom-prompt"
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleExecuteAction('continue');
                      }
                    }}
                    placeholder="e.g. Suggest a sound in the courtyard..."
                    className="flex-1 px-3 py-1.5 text-xs font-manuscript border focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleExecuteAction('continue')}
                    disabled={!customPrompt.trim() || loadingAction !== null}
                    className="px-3 py-1 text-xs font-manuscript rounded-sm cursor-pointer disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: '#F4EFE5',
                    }}
                  >
                    Pen
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
