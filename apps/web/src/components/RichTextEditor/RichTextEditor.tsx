import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import RichTextEditorToolbar from './RichTextEditorToolbar';

interface RichTextEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: string;
  maxHeight?: string;
  onSend?: () => void;
  /** Return true to prevent ProseMirror from handling the key event */
  onKeyDown?: (event: KeyboardEvent) => boolean;
}

export interface RichTextEditorHandle {
  /** Replace the last @word in the editor with @username + space */
  replaceMention: (username: string) => void;
  /** Get the cursor position in viewport coordinates for dropdown placement */
  getCursorCoords: () => { top: number; left: number } | null;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor({
  value,
  onChange,
  placeholder = 'Type a message...',
  autoFocus = false,
  minHeight = '40px',
  maxHeight = '160px',
  onSend,
  onKeyDown,
}, ref) {
  const [showPreview, setShowPreview] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      onChange(text);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3 min-h-[40px] max-h-[160px] overflow-y-auto',
        style: `min-height: ${minHeight}; max-height: ${maxHeight};`,
      },
      handleKeyDown: (_view, event) => {
        // Give parent a chance to intercept (e.g. mention dropdown navigation)
        if (onKeyDown && onKeyDown(event)) {
          return true;
        }
        if (event.key === 'Enter' && !event.shiftKey && onSend) {
          event.preventDefault();
          onSend();
          return true;
        }
        return false;
      },
    },
    autofocus: autoFocus ? 'end' : false,
  });

  // Expose methods for mention insertion
  useImperativeHandle(ref, () => ({
    replaceMention: (username) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(0, from, ' ');
      // Find the last '@' before cursor
      const atIdx = textBefore.lastIndexOf('@');
      if (atIdx === -1) return;
      // Replace from '@' to cursor with '@username '
      editor
        .chain()
        .focus()
        .deleteRange({ from: atIdx + 1, to })
        .insertContent(`${username} `)
        .run();
    },
    getCursorCoords: () => {
      if (!editor) return null;
      const { view } = editor;
      const coords = view.coordsAtPos(view.state.selection.from);
      if (!coords) return null;
      const editorEl = view.dom.closest('.ProseMirror') as HTMLElement | null;
      if (!editorEl) return null;
      const editorRect = editorEl.getBoundingClientRect();
      return {
        left: coords.left,
        top: editorRect.bottom + 4,
      };
    },
  }));

  const handleTogglePreview = useCallback(() => {
    setShowPreview((p) => !p);
  }, []);

  // When external value is cleared (after send), sync editor content
  useEffect(() => {
    if (editor && value === '' && editor.getText() !== '') {
      editor.commands.setContent('');
    }
  }, [value, editor]);

  // Simple markdown-like preview renderer
  const renderPreview = (text: string) => {
    if (!text.trim()) {
      return <p className="text-text-secondary italic">Nothing to preview</p>;
    }

    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    lines.forEach((line, i) => {
      // Code block fence
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={i} className="bg-bg rounded p-2 my-1 overflow-x-auto text-sm font-mono">
              <code>{codeLines.join('\n')}</code>
            </pre>,
          );
          codeLines = [];
        }
        inCodeBlock = !inCodeBlock;
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      // Empty line
      if (!line.trim()) {
        elements.push(<br key={i} />);
        return;
      }

      // Heading
      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-base font-bold mt-2">{line.slice(4)}</h3>);
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-lg font-bold mt-3">{line.slice(3)}</h2>);
        return;
      }
      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="text-xl font-bold mt-3">{line.slice(2)}</h1>);
        return;
      }

      // Horizontal rule
      if (line === '---' || line === '***') {
        elements.push(<hr key={i} className="my-2 border-border" />);
        return;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={i} className="border-l-4 border-primary-300 pl-3 py-1 my-1 text-text-secondary italic">
            {inlinePreview(line.slice(2))}
          </blockquote>,
        );
        return;
      }

      // Unordered list
      if (line.match(/^[-*+]\s/)) {
        elements.push(
          <li key={i} className="ml-4 list-disc text-sm">{inlinePreview(line.replace(/^[-*+]\s/, ''))}</li>,
        );
        return;
      }

      // Ordered list
      if (line.match(/^\d+\.\s/)) {
        elements.push(
          <li key={i} className="ml-4 list-decimal text-sm">{inlinePreview(line.replace(/^\d+\.\s/, ''))}</li>,
        );
        return;
      }

      // Regular paragraph
      elements.push(<p key={i} className="text-sm">{inlinePreview(line)}</p>);
    });

    return <>{elements}</>;
  };

  // Inline: bold, italic, code, inline code
  const inlinePreview = (text: string) => {
    // Bold: **text**
    const boldRegex = /\*\*(.+?)\*\*/g;
    // Italic: *text*
    const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
    // Inline code: `text`
    const codeRegex = /`(.+?)`/g;

    // Simple ordered replacement
    const elements: JSX.Element[] = [];
    let lastIndex = 0;
    const matches: { index: number; length: number; type: string; content: string }[] = [];

    // Collect all inline matches
    let m;
    const codeRe = new RegExp(codeRegex.source, 'g');
    while ((m = codeRe.exec(text)) !== null) {
      matches.push({ index: m.index, length: m[0].length, type: 'code', content: m[1] });
    }
    const boldRe = new RegExp(boldRegex.source, 'g');
    while ((m = boldRe.exec(text)) !== null) {
      matches.push({ index: m.index, length: m[0].length, type: 'bold', content: m[1] });
    }
    const italicRe = new RegExp(italicRegex.source, 'g');
    while ((m = italicRe.exec(text)) !== null) {
      matches.push({ index: m.index, length: m[0].length, type: 'italic', content: m[1] });
    }

    matches.sort((a, b) => a.index - b.index);

    for (const match of matches) {
      if (match.index > lastIndex) {
        elements.push(<span key={lastIndex}>{text.slice(lastIndex, match.index)}</span>);
      }
      if (match.type === 'bold') {
        elements.push(<strong key={match.index}>{match.content}</strong>);
      } else if (match.type === 'italic') {
        elements.push(<em key={match.index}>{match.content}</em>);
      } else if (match.type === 'code') {
        elements.push(
          <code key={match.index} className="bg-bg px-1.5 py-0.5 rounded text-xs font-mono text-primary-600">
            {match.content}
          </code>,
        );
      }
      lastIndex = match.index + match.length;
    }
    if (lastIndex < text.length) {
      elements.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>);
    }

    return elements.length > 0 ? <>{elements}</> : text;
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface focus-within:border-primary-400 transition-colors">
      <RichTextEditorToolbar editor={editor} onTogglePreview={handleTogglePreview} showPreview={showPreview} />
      {showPreview ? (
        <div className="px-4 py-3 min-h-[40px] max-h-[160px] overflow-y-auto text-sm">
          {renderPreview(editor?.getText() || '')}
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
});

export default RichTextEditor;