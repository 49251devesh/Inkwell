import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Compass,
  Copy,
  Feather,
  PlusCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { CornerOrnament, FleuronDivider } from '../ornaments/Ornaments';
import { getAIHeaders, providerLabel } from '../../lib/aiClient';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isOffline?: boolean;
  provider?: string;
  model?: string;
}

export interface AIConversationalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentChapterText?: string;
  chapterTitle?: string;
  projectTitle?: string;
  projectGenre?: string;
  characters?: Array<{
    name: string;
    role?: string;
    traits?: string[];
    motivation?: string;
    arc?: string;
    relationships?: string;
  }>;
  worldNotes?: Array<{
    title?: string;
    name?: string;
    category?: string;
    description?: string;
  }>;
  onInsertText?: (text: string) => void;
}

const SUGGESTED_PROMPTS = [
  { id: 'twist', label: 'Brainstorm a plot twist', icon: Sparkles },
  { id: 'improve', label: 'Improve this passage', icon: Feather },
  { id: 'continuity', label: 'Check continuity', icon: Compass },
  { id: 'summarize', label: 'Summarize this scene', icon: RotateCcw },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'init-1',
    role: 'assistant',
    content:
      'Welcome to your private study. I am your dramaturg and literary collaborator. I honor your authorial voice and will never alter your prose without invitation.\n\nAsk me to interrogate character psychology, test narrative tension, check world continuity, or brainstorm unexpected complications.',
    timestamp: 'Just now',
    isOffline: false,
  },
];

export const AIConversationalDrawer: React.FC<AIConversationalDrawerProps> = ({
  isOpen,
  onClose,
  currentChapterText = '',
  chapterTitle = 'Untitled Chapter',
  projectTitle = 'Current Manuscript',
  projectGenre = 'Literary Fiction',
  characters = [],
  worldNotes = [],
  onInsertText,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false);
      // Focus textarea after drawer animation
      const t = setTimeout(() => textareaRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isStreaming, scrollToBottom]);

  // Auto-grow textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [inputValue]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setIsStreaming(true);

    const assistantMsgId = `ast-${Date.now()}`;
    // Temporary empty assistant placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    try {
      // Build conversation payload for the server
      const chatPayload = {
        messages: newHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        currentChapter: {
          title: chapterTitle,
          content: currentChapterText,
        },
        characters,
        worldNotes,
        projectTitle,
        projectGenre,
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAIHeaders(),
        },
        body: JSON.stringify(chatPayload),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let isOfflineFlag = false;

      let doneReading = false;
      while (!doneReading) {
        const { value, done } = await reader.read();
        if (done) {
          doneReading = true;
          break;
        }

        const rawChunk = decoder.decode(value, { stream: true });
        // Process SSE lines
        const lines = rawChunk.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataPayload = trimmed.replace(/^data:\s*/, '');
          if (dataPayload === '[DONE]') {
            doneReading = true;
            break;
          }

          let parsed: { meta?: { provider: string; model: string }; text?: string; offline?: boolean; error?: string } | null = null;
          try {
            parsed = JSON.parse(dataPayload);
          } catch {
            parsed = null;
          }
          if (parsed) {
            if (parsed.meta) {
              const { provider, model } = parsed.meta;
              setMessages((prev) => prev.map((msg) => msg.id === assistantMsgId ? { ...msg, provider, model } : msg));
            }
            if (parsed.text) {
              accumulatedText += parsed.text;
              if (parsed.offline) isOfflineFlag = true;

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content: accumulatedText,
                        isOffline: isOfflineFlag,
                      }
                    : msg
                )
              );
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } else {
            // If raw text chunk without JSON wrapping
            if (dataPayload && dataPayload !== '[DONE]') {
              accumulatedText += dataPayload;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content: accumulatedText,
                      }
                    : msg
                )
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn('Conversational streaming error:', err);
      // Graceful local error message fallback
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  msg.content ||
                  '[Offline Atelier Mentor]\n\nThe quill paused as the atelier connection dropped. Your manuscript and local notes remain safe. You may retry your query or continue drafting uninterrupted.',
                isOffline: true,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsertMessage = (id: string, text: string) => {
    if (!onInsertText) return;
    onInsertText(text);
    setInsertedId(id);
    setTimeout(() => setInsertedId(null), 2000);
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined' || !document.body) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle Dim Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
            style={{ zIndex: 99990 }}
          />

          {/* Right Sliding Drawer (Responsive: Full-screen sheet on mobile, 480px on sm+) */}
          <motion.aside
            initial={{ x: '100%', opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 290 }}
            className="fixed inset-y-0 right-0 h-full w-full sm:max-w-[480px] bg-[var(--bg-surface)] text-[var(--text-primary)] border-l border-[var(--border-brass)] shadow-2xl flex flex-col overflow-hidden"
            style={{ zIndex: 99995 }}
          >
            {/* Corner Ornaments */}
            <CornerOrnament position="tl" />
            <CornerOrnament position="tr" />

            {/* Atelier Header */}
            <header className="px-5 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border border-[var(--border-brass)] flex items-center justify-center shadow-xs"
                  style={{ background: 'var(--burgundy-wash)' }}
                >
                  <Feather className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-base font-semibold tracking-tight text-[var(--text-primary)]">
                      Atelier Dramaturg
                    </h2>
                    <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-[var(--border-brass)] text-[var(--accent-brass-bright)] bg-[var(--bg-surface)] font-semibold">
                      Live
                    </span>
                  </div>
                  <p className="font-manuscript text-xs text-[var(--text-secondary)] italic">
                    Conversational literary counsel · {chapterTitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close conversation drawer"
                className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--burgundy-wash)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[var(--bg-surface)]">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    {/* Role Stamp & Timestamp */}
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--text-secondary)] font-medium">
                        {isUser ? 'Author' : 'Dramaturg'}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] opacity-60">·</span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        {msg.timestamp}
                      </span>
                      {!isUser && (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] text-[var(--accent-brass-bright)] bg-[var(--bg-canvas)] px-1.5 py-0.5 rounded border border-[var(--border-brass)]/60 uppercase tracking-wider font-medium">
                          ✦ AI-Generated
                        </span>
                      )}
                      {!isUser && msg.isOffline && (
                        <span className="font-mono text-[9px] text-[var(--accent-primary)] dark:text-[#E89BA4] bg-[var(--burgundy-wash)] px-1 py-0.5 rounded uppercase font-medium">
                          Offline
                        </span>
                      )}
                      {!isUser && msg.provider && msg.model && (
                        <span className="font-mono text-[9px] text-[var(--accent-brass-bright)]">
                          {providerLabel(msg.provider, msg.model)}
                        </span>
                      )}
                    </div>

                    {/* Message Card */}
                    <div
                      className={`relative max-w-[92%] rounded-md px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-[var(--burgundy-wash)] dark:bg-[#3D1E23] text-[var(--text-primary)] dark:text-[#FDFBF7] border border-[var(--accent-primary)]/40 shadow-xs'
                          : 'bg-[var(--parchment-raised)] dark:bg-[#252420] text-[var(--text-primary)] dark:text-[#F4EFE5] border border-[var(--border-hairline)] dark:border-[var(--border-brass)]/30 shadow-sm'
                      }`}
                      style={{
                        boxShadow: isUser ? undefined : 'var(--shadow-paper)',
                      }}
                    >
                      <div className="font-manuscript text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--text-primary)] dark:text-[#F4EFE5]">
                        {msg.content || (
                          /* Typing Indicator for active stream chunk */
                          <div className="flex items-center gap-2 py-1 text-[var(--text-secondary)] dark:text-[#D4BC98]">
                            <Feather className="w-3.5 h-3.5 animate-pulse text-[var(--accent-brass-bright)]" />
                            <span className="font-manuscript italic text-xs text-[var(--text-secondary)] dark:text-[#D4BC98]">
                              The quill moves across vellum...
                            </span>
                            <div className="flex gap-1 ml-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Assistant Action Bar (Copy / Insert) */}
                      {!isUser && msg.content && (
                        <div className="mt-3 pt-2.5 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs">
                          <span className="font-mono text-[10px] text-[var(--text-muted)] dark:text-[#A39886] select-none">
                            ❦ Atelier note
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="px-2.5 py-1 rounded text-[11px] font-mono text-[var(--text-primary)] dark:text-[#F4EFE5] bg-[var(--bg-canvas)] dark:bg-[#1A1916] hover:bg-[var(--bg-recessed)] dark:hover:bg-[#2C2B26] border border-[var(--border-hairline)] hover:border-[var(--border-brass)] flex items-center gap-1 transition-colors cursor-pointer"
                              title="Copy response to clipboard"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-500 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            {onInsertText && (
                              <button
                                type="button"
                                onClick={() => handleInsertMessage(msg.id, msg.content)}
                                className="px-2.5 py-1 rounded text-[11px] font-mono text-[var(--accent-primary)] dark:text-[#E89BA4] bg-[var(--bg-canvas)] dark:bg-[#1A1916] hover:bg-[var(--burgundy-wash)] border border-[var(--accent-primary)]/40 hover:border-[var(--accent-primary)] flex items-center gap-1 transition-colors cursor-pointer font-medium"
                                title="Insert into manuscript at caret position"
                              >
                                {insertedId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    <span className="text-emerald-500 font-medium">Inserted</span>
                                  </>
                                ) : (
                                  <>
                                    <PlusCircle className="w-3 h-3" />
                                    <span>Insert into manuscript</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Prompt Pills */}
            <div className="px-5 pt-2.5 pb-3.5 border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium select-none">
                  Inquire of the Scribe
                </span>
                <span className="text-[10px] text-[var(--accent-brass-bright)]">✦</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.id}
                      type="button"
                      disabled={isStreaming}
                      onClick={() => handleSendMessage(prompt.label)}
                      className="px-2.5 py-2 rounded text-left font-manuscript text-xs text-[var(--text-primary)] dark:text-[#F4EFE5] bg-[var(--bg-surface)] dark:bg-[#252420] hover:bg-[var(--bg-recessed)] dark:hover:bg-[#302E28] border border-[var(--border-hairline)] hover:border-[var(--border-brass)] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                    >
                      <Icon className="w-3 h-3 shrink-0 text-[var(--accent-brass-bright)]" />
                      <span className="truncate">{prompt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auto-growing Input & Send Control */}
            <div className="p-4 border-t border-[var(--border-brass)] bg-[var(--bg-canvas)] shrink-0">
              <div className="relative flex items-end gap-2 bg-[var(--bg-surface)] dark:bg-[#201F1B] rounded-md border border-[var(--border-brass)] focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)]/30 p-2 shadow-inner transition-all">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputValue}
                  disabled={isStreaming}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Converse with your atelier dramaturg..."
                  className="flex-1 max-h-36 resize-none bg-transparent font-manuscript text-sm text-[var(--text-primary)] dark:text-[#F4EFE5] placeholder-[var(--text-muted)] dark:placeholder-[#8C8272] outline-none leading-relaxed px-1.5 py-0.5"
                  style={{ minHeight: '38px' }}
                />

                <button
                  type="button"
                  disabled={!inputValue.trim() || isStreaming}
                  onClick={() => handleSendMessage()}
                  aria-label="Send message to dramaturg"
                  className="shrink-0 w-8 h-8 rounded flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#F4EFE5',
                  }}
                >
                  {isStreaming ? (
                    <Feather className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between mt-2 px-1">
                <p className="font-mono text-[10px] text-[var(--text-secondary)]">
                  Enter to send · Shift+Enter for newline
                </p>
                <span className="font-manuscript text-[11px] italic text-[var(--text-muted)]">
                  Respects author voice
                </span>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

