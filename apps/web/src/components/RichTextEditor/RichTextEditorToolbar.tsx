import { Editor } from '@tiptap/react';

interface ToolbarProps {
  editor: Editor | null;
  onTogglePreview: () => void;
  showPreview: boolean;
}

export default function RichTextEditorToolbar({ editor, onTogglePreview, showPreview }: ToolbarProps) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `p-1.5 rounded transition-colors ${
      active
        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
        : 'text-text-secondary hover:bg-border hover:text-text'
    }`;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-bg/50 flex-wrap">
      {/* Bold */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive('bold'))}
        title="Bold (Ctrl+B)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 3h7.5a4.5 4.5 0 010 9H5V3zm0 9h9a4.5 4.5 0 010 9H5v-9z" />
        </svg>
      </button>

      {/* Italic */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive('italic'))}
        title="Italic (Ctrl+I)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="14" y1="5" x2="10" y2="19" strokeWidth={2.5} strokeLinecap="round" />
          <line x1="7" y1="19" x2="17" y2="19" strokeWidth={2.5} strokeLinecap="round" />
          <line x1="7" y1="5" x2="15" y2="5" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
      </button>

      {/* Separator */}
      <div className="w-px h-5 mx-1 bg-border" />

      {/* Heading 1 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btnClass(editor.isActive('heading', { level: 1 }))}
        title="Heading 1"
      >
        <span className="text-xs font-bold leading-none">H1</span>
      </button>

      {/* Heading 2 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive('heading', { level: 2 }))}
        title="Heading 2"
      >
        <span className="text-xs font-bold leading-none">H2</span>
      </button>

      {/* Heading 3 */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(editor.isActive('heading', { level: 3 }))}
        title="Heading 3"
      >
        <span className="text-xs font-bold leading-none">H3</span>
      </button>

      {/* Separator */}
      <div className="w-px h-5 mx-1 bg-border" />

      {/* Bullet List */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive('bulletList'))}
        title="Bullet list"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="2" cy="6" r="1.5" fill="currentColor" />
          <circle cx="2" cy="12" r="1.5" fill="currentColor" />
          <circle cx="2" cy="18" r="1.5" fill="currentColor" />
        </svg>
      </button>

      {/* Ordered List */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive('orderedList'))}
        title="Ordered list"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h10M10 12h10M10 18h10" />
          <text x="1" y="8" fontSize="8" fontWeight="bold" fill="currentColor">1</text>
          <text x="1" y="14" fontSize="8" fontWeight="bold" fill="currentColor">2</text>
          <text x="1" y="20" fontSize="8" fontWeight="bold" fill="currentColor">3</text>
        </svg>
      </button>

      {/* Separator */}
      <div className="w-px h-5 mx-1 bg-border" />

      {/* Code Block */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btnClass(editor.isActive('codeBlock'))}
        title="Code block"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </button>

      {/* Blockquote */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(editor.isActive('blockquote'))}
        title="Blockquote"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h12M6 12h12m-6 6h6" />
          <text x="2" y="9" fontSize="5" fill="currentColor">❝</text>
          <text x="2" y="15" fontSize="5" fill="currentColor">❝</text>
        </svg>
      </button>

      {/* Separator */}
      <div className="w-px h-5 mx-1 bg-border" />

      {/* Horizontal rule */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btnClass(false)}
        title="Horizontal line"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="4" y1="12" x2="20" y2="12" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Preview toggle */}
      <button
        type="button"
        onClick={onTogglePreview}
        className={`p-1.5 rounded transition-colors ${
          showPreview
            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
            : 'text-text-secondary hover:bg-border hover:text-text'
        }`}
        title="Toggle preview"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
    </div>
  );
}
