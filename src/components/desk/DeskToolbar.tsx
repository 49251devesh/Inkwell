import React from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Quote,
  Undo2,
  Redo2,
  Sparkles,
  Maximize2,
  Minimize2,
  SplitSquareVertical,
} from 'lucide-react';

interface DeskToolbarProps {
  onFormat: (command: string, value?: string) => void;
  onInsertSceneBreak: () => void;
  onToggleFocusMode: () => void;
  onToggleAIPanel: () => void;
  isFocusMode: boolean;
  isAIPanelOpen: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  className?: string;
}

export const DeskToolbar: React.FC<DeskToolbarProps> = ({
  onFormat,
  onInsertSceneBreak,
  onToggleFocusMode,
  onToggleAIPanel,
  isFocusMode,
  isAIPanelOpen,
  canUndo = true,
  canRedo = true,
  className = '',
}) => {
  const handleAction = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault();
    fn();
  };

  return (
    <div
      role="toolbar"
      aria-label="Manuscript formatting toolbar"
      className={`inline-flex items-center gap-1 p-1 rounded-sm border backdrop-blur-md select-none transition-all duration-300 max-w-full overflow-x-auto ${className}`}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
        borderColor: 'var(--border-brass)',
        boxShadow: 'var(--shadow-paper)',
      }}
    >
      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 pr-1 border-r" style={{ borderColor: 'var(--border-hairline)' }}>
        <button
          type="button"
          onMouseDown={(e) => handleAction(e, () => onFormat('undo'))}
          disabled={!canUndo}
          title="Undo (Ctrl/Cmd+Z)"
          aria-label="Undo"
          className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)] disabled:opacity-30 disabled:pointer-events-none"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Undo2 className="w-3.5 h-3.5" strokeWidth={1.4} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => handleAction(e, () => onFormat('redo'))}
          disabled={!canRedo}
          title="Redo (Ctrl/Cmd+Y or Cmd+Shift+Z)"
          aria-label="Redo"
          className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)] disabled:opacity-30 disabled:pointer-events-none"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Redo2 className="w-3.5 h-3.5" strokeWidth={1.4} />
        </button>
      </div>

      {/* Typography Inline Formats */}
      <div className="flex items-center gap-0.5 px-1 border-r" style={{ borderColor: 'var(--border-hairline)' }}>
        <button
          type="button"
          onMouseDown={(e) => handleAction(e, () => onFormat('bold'))}
          title="Bold (Ctrl/Cmd+B)"
          aria-label="Bold text"
          className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)]"
          style={{ color: 'var(--text-primary)' }}
        >
          <Bold className="w-3.5 h-3.5" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => handleAction(e, () => onFormat('italic'))}
          title="Italic (Ctrl/Cmd+I)"
          aria-label="Italic text"
          className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)]"
          style={{ color: 'var(--text-primary)' }}
        >
          <Italic className="w-3.5 h-3.5" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => handleAction(e, () => onFormat('underline'))}
          title="Underline (Ctrl/Cmd+U)"
          aria-label="Underline text"
          className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)]"
          style={{ color: 'var(--text-primary)' }}
        >
          <UnderlineIcon className="w-3.5 h-3.5" strokeWidth={1.6} />
        </button>
      </div>

      {/* Block Formats */}
      <div className="flex items-center gap-0.5 px-1 border-r" style={{ borderColor: 'var(--border-hairline)' }}>
        <button
          type="button"
          onMouseDown={(e) => handleAction(e, () => onFormat('formatBlock', '<h1>'))}
          title="Chapter Heading (H1)"
          aria-label="Heading 1"
          className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)]"
          style={{ color: 'var(--text-primary)' }}
        >
          <Heading1 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => handleAction(e, () => onFormat('formatBlock', '<h2>'))}
          title="Scene Section (H2)"
          aria-label="Heading 2"
          className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)]"
          style={{ color: 'var(--text-primary)' }}
        >
          <Heading2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => handleAction(e, () => onFormat('formatBlock', '<blockquote>'))}
          title="Pull Quote / Epigraph"
          aria-label="Blockquote"
          className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)]"
          style={{ color: 'var(--text-primary)' }}
        >
          <Quote className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Fleuron Scene Break */}
      <div className="flex items-center gap-0.5 px-1 border-r" style={{ borderColor: 'var(--border-hairline)' }}>
        <button
          type="button"
          onMouseDown={(e) => handleAction(e, onInsertSceneBreak)}
          title="Insert Fleuron Scene Break (❦ ✦ ❦)"
          aria-label="Insert scene break"
          className="px-2 py-1 text-xs font-serif leading-none rounded transition-colors hover:bg-[var(--burgundy-wash)] flex items-center gap-1"
          style={{ color: 'var(--accent-brass)' }}
        >
          <SplitSquareVertical className="w-3 h-3" strokeWidth={1.4} />
          <span className="font-serif">❦</span>
        </button>
      </div>

      {/* Tools: AI Margin Assistant & Focus Mode */}
      <div className="flex items-center gap-1 pl-1">
        <button
          type="button"
          onClick={onToggleAIPanel}
          title="AI Margin Assistant (Notes & Critiques)"
          aria-label="Toggle AI Margin Notes"
          className="px-2.5 py-1 text-xs font-manuscript rounded inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          style={{
            backgroundColor: isAIPanelOpen ? 'var(--accent-primary)' : 'transparent',
            color: isAIPanelOpen ? '#F4EFE5' : 'var(--text-primary)',
          }}
        >
          <Sparkles className="w-3 h-3" strokeWidth={1.5} />
          <span className="hidden sm:inline">Margin Notes</span>
        </button>

        <button
          type="button"
          onClick={onToggleFocusMode}
          title={isFocusMode ? 'Exit Distraction-Free Focus (Esc)' : 'Enter Distraction-Free Focus'}
          aria-label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
          className="p-1.5 rounded transition-colors hover:bg-[var(--burgundy-wash)] cursor-pointer"
          style={{ color: isFocusMode ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
        >
          {isFocusMode ? (
            <Minimize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
};
