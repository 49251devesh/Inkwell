import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { countWords, toRoman } from '../../lib/formatters';
import { CornerOrnament, FleuronDivider } from '../ornaments/Ornaments';
import { Edit3 } from 'lucide-react';

export interface ManuscriptEditorHandle {
  executeFormat: (command: string, value?: string) => void;
  insertSceneBreak: () => void;
  insertTextAtCursor: (text: string) => void;
  replaceSelectedText: (replacement: string) => void;
  focus: () => void;
}

interface ManuscriptEditorProps {
  chapterId: string;
  initialContent: string;
  chapterOrder: number;
  chapterTitle: string;
  onTitleChange?: (newTitle: string) => void;
  onChange: (htmlContent: string, wordCount: number) => void;
  onSelectionChange?: (selectedText: string) => void;
  isFocusMode?: boolean;
  dimNonActiveParagraphs?: boolean;
}

function normalizeToHtml(raw: string): string {
  if (!raw || !raw.trim()) {
    return '<p><br></p>';
  }
  // If raw is already HTML paragraphs
  if (/<(p|h1|h2|h3|blockquote|div)[\s>]/i.test(raw)) {
    return raw;
  }
  // Convert plain text double-newlines to <p> tags
  const paragraphs = raw.split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length === 0) return '<p><br></p>';
  return paragraphs
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export const ManuscriptEditor = forwardRef<ManuscriptEditorHandle, ManuscriptEditorProps>(
  (
    {
      chapterId,
      initialContent,
      chapterOrder,
      chapterTitle,
      onTitleChange,
      onChange,
      onSelectionChange,
      isFocusMode = false,
      dimNonActiveParagraphs = false,
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [savedSelection, setSavedSelection] = useState<Range | null>(null);
    const lastEmittedHtmlRef = useRef<string>('');

    // Ensure editor content stays synced when chapter truly switches
    useEffect(() => {
      if (editorRef.current) {
        const normalized = normalizeToHtml(initialContent);
        if (editorRef.current.innerHTML !== normalized && editorRef.current.innerHTML !== lastEmittedHtmlRef.current) {
          editorRef.current.innerHTML = normalized;
        }
      }
    }, [chapterId, initialContent]);

    // Handle selection changes
    const handleSelectionUpdate = useCallback(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current) {
        onSelectionChange?.('');
        return;
      }
      const anchorNode = sel.anchorNode;
      if (anchorNode && editorRef.current.contains(anchorNode)) {
        const text = sel.toString();
        onSelectionChange?.(text);
        if (!sel.isCollapsed) {
          setSavedSelection(sel.getRangeAt(0).cloneRange());
        }
      }
    }, [onSelectionChange]);

    useEffect(() => {
      document.addEventListener('selectionchange', handleSelectionUpdate);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionUpdate);
      };
    }, [handleSelectionUpdate]);

    const handleInput = useCallback(() => {
      if (!editorRef.current) return;
      const html = editorRef.current.innerHTML;
      lastEmittedHtmlRef.current = html;
      const words = countWords(html);
      onChange(html, words);
    }, [onChange]);

    // Expose formatting handle to parent / floating toolbar
    useImperativeHandle(
      ref,
      () => ({
        executeFormat: (command: string, value?: string) => {
          if (!editorRef.current) return;
          editorRef.current.focus();
          if (savedSelection) {
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(savedSelection);
            }
          }
          document.execCommand(command, false, value);
          handleInput();
        },
        insertSceneBreak: () => {
          if (!editorRef.current) return;
          editorRef.current.focus();
          const breakHtml =
            '<div class="manuscript-scene-break" contenteditable="false" style="text-align: center; margin: 2rem 0; color: var(--accent-brass); letter-spacing: 0.35em; font-family: serif; user-select: none;">❦ ✦ ❦</div><p><br></p>';
          document.execCommand('insertHTML', false, breakHtml);
          handleInput();
        },
        insertTextAtCursor: (text: string) => {
          if (!editorRef.current) return;
          editorRef.current.focus();
          const cleanParagraphs = text
            .split(/\n\s*\n/)
            .map((p) => `<p>${p.trim()}</p>`)
            .join('');
          document.execCommand('insertHTML', false, cleanParagraphs || `<p>${text}</p>`);
          handleInput();
        },
        replaceSelectedText: (replacement: string) => {
          if (!editorRef.current) return;
          editorRef.current.focus();
          if (savedSelection) {
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(savedSelection);
            }
          }
          const cleanReplacement = replacement
            .split(/\n\s*\n/)
            .map((p) => `<p>${p.trim()}</p>`)
            .join('');
          document.execCommand('insertHTML', false, cleanReplacement || replacement);
          handleInput();
        },
        focus: () => {
          editorRef.current?.focus();
        },
      }),
      [handleInput, savedSelection]
    );

    // Keyboard shortcuts handler (Cmd+B, Cmd+I, Cmd+U)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        document.execCommand('bold', false);
        handleInput();
      } else if (isMod && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        document.execCommand('italic', false);
        handleInput();
      } else if (isMod && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        document.execCommand('underline', false);
        handleInput();
      }
    };

    return (
      <div className="relative w-full max-w-[820px] mx-auto transition-all duration-500">
        {/* Parchment Sheet Layer */}
        <article
          onClick={() => {
            if (document.activeElement !== editorRef.current) {
              editorRef.current?.focus();
            }
          }}
          className={`relative paper-folio cursor-text transition-all duration-300 ${
            isFocusMode
              ? 'p-8 sm:p-14 md:p-20 shadow-2xl'
              : 'p-7 sm:p-12 md:p-16'
          }`}
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-hairline)',
            boxShadow: 'var(--shadow-stacked)',
          }}
        >
          {/* Subtle Brass Corner Accents */}
          <CornerOrnament position="tl" />
          <CornerOrnament position="tr" />
          <CornerOrnament position="bl" />
          <CornerOrnament position="br" />

          {/* Faint Red/Burgundy Left Marginal Rule */}
          <div
            aria-hidden="true"
            className="hidden sm:block absolute top-12 bottom-12 left-10 w-px pointer-events-none"
            style={{ backgroundColor: 'var(--margin-rule)' }}
          />

          {/* Folio Head & Chapter Numeral */}
          <header className="mb-8 pb-6 border-b text-center relative" style={{ borderColor: 'var(--border-hairline)' }}>
            <span
              className="small-caps-meta text-xs tracking-[0.2em]"
              style={{ color: 'var(--accent-brass)' }}
            >
              Folio {toRoman(chapterOrder)}
            </span>

            {/* Editable Chapter Title */}
            <div className="relative group max-w-lg mx-auto mt-2">
              <input
                type="text"
                value={chapterTitle}
                onChange={(e) => onTitleChange?.(e.target.value)}
                placeholder="Untitled Chapter"
                className="w-full text-center font-display text-2xl sm:text-3xl md:text-4xl font-medium bg-transparent border-b border-transparent hover:border-[var(--border-brass)] focus:border-[var(--accent-primary)] focus:outline-none leading-tight transition-colors py-1 px-2"
                style={{ color: 'var(--text-primary)' }}
                title="Click to rename chapter"
              />
              <span
                aria-hidden="true"
                className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              >
                <Edit3 className="w-4 h-4" />
              </span>
            </div>

            <FleuronDivider symbol="✦" className="my-5 max-w-xs mx-auto" />
          </header>

          {/* The contentEditable Page */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: normalizeToHtml(initialContent) }}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            role="textbox"
            aria-multiline="true"
            data-placeholder="Dip your quill into the inkwell and begin drafting your manuscript here…"
            aria-label={`Manuscript content for ${chapterTitle}`}
            className={`manuscript-editor-content min-h-[500px] focus:outline-none font-manuscript text-[18px] sm:text-[19px] leading-[1.8] select-text caret-[var(--accent-primary)] ${
              dimNonActiveParagraphs ? 'focus-dimming' : ''
            }`}
            style={{
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
            }}
          />
        </article>
      </div>
    );
  }
);

ManuscriptEditor.displayName = 'ManuscriptEditor';
