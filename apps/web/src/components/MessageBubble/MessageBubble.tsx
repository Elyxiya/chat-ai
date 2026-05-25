import { useMemo, useState, useRef, useEffect } from 'react';
import MarkdownIt from 'markdown-it';
import { ChatMessage } from '@/types';
import { format } from 'date-fns';
import FilePreviewModal from '../FilePreviewModal/FilePreviewModal';
import LazyImage from '../LazyImage/LazyImage';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onReaction?: (emoji: string) => void;
  onReply?: (message: ChatMessage) => void;
}

export default function MessageBubble({ message, isOwn, onReaction, onReply }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowReactions(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const content = useMemo(() => {
    if (message.isRecalled) {
      return (
        <p className="text-text-secondary italic text-sm">
          This message has been recalled
        </p>
      );
    }

    if (message.contentType === 'image') {
      return (
        <button onClick={() => setPreviewSrc(message.content)} className="text-left">
          <LazyImage
            src={message.content}
            alt="Shared image"
            className="max-w-[300px] max-h-[300px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          />
        </button>
      );
    }

    if (message.contentType === 'file') {
      const fileName = message.metadata?.fileName || 'Download file';
      return (
        <button
          onClick={() => setPreviewSrc(message.content)}
          className="flex items-center gap-3 px-3 py-2 bg-bg rounded-lg border border-border hover:bg-border transition-colors text-sm w-full text-left"
        >
          <svg className="w-6 h-6 text-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div className="min-w-0">
            <p className="truncate font-medium">{fileName}</p>
            {message.metadata?.fileSize && (
              <p className="text-xs text-text-secondary">{formatFileSize(message.metadata.fileSize)}</p>
            )}
          </div>
        </button>
      );
    }

    if (message.contentType === 'audio') {
      return (
        <audio controls className="max-w-[280px] h-10" preload="metadata">
          <source src={message.content} />
        </audio>
      );
    }

    if (message.contentType === 'video') {
      return (
        <video controls className="max-w-[300px] max-h-[300px] rounded-lg" preload="metadata">
          <source src={message.content} />
        </video>
      );
    }

    if (message.contentType === 'ai_response') {
      return <StreamingMarkdown text={message.content} />;
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
  }, [message]);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group relative`}>
      <div className={`max-w-[85%] md:max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`} ref={menuRef}>
        {!isOwn && message.sender && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <LazyImage
              src={message.sender.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${message.sender.username}`}
              alt={message.sender.username}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-xs font-medium text-text-secondary">
              {message.sender.nickname || message.sender.username}
            </span>
          </div>
        )}

        {message.replyTo && (
          <div className="mb-1 px-3 py-1.5 bg-surface border-l-2 border-primary-300 rounded text-xs text-text-secondary">
            <span className="font-medium">{message.replyTo.sender?.username}: </span>
            {message.replyTo.content.slice(0, 50)}
            {message.replyTo.content.length > 50 ? '...' : ''}
          </div>
        )}

        <div
          className={`px-3.5 py-2.5 rounded-2xl ${
            isOwn
              ? 'bg-primary-600 text-white rounded-br-md'
              : message.contentType === 'system'
                ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm'
                : 'bg-surface border border-border rounded-bl-md'
          }`}
        >
          {content}
        </div>

        <div className={`flex items-center gap-2 mt-1 px-1 ${isOwn ? 'justify-end' : ''}`}>
          <span className="text-xs text-text-secondary">
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex items-center gap-1">
              {message.reactions.map((r) => (
                <span key={r.id} className="text-sm">{r.emoji}</span>
              ))}
            </div>
          )}
          {!isOwn && (
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-border transition-all"
            >
              <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* Reaction & more menu */}
        {showMenu && (
          <div className="absolute z-10 mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
            <button
              onClick={() => { setShowReactions(!showReactions); setShowMenu(false); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg flex items-center gap-2"
            >
              <span>Add Reaction</span>
            </button>
            <button
              onClick={() => { if (onReply) { onReply(message); } setShowMenu(false); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg flex items-center gap-2"
            >
              <span>Reply</span>
            </button>
          </div>
        )}

        {/* Reaction picker */}
        {showReactions && (
          <div className="absolute z-10 mt-1 bg-surface border border-border rounded-full shadow-lg px-2 py-1 flex items-center gap-1">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { if (onReaction) { onReaction(emoji); } setShowReactions(false); }}
                className="text-lg hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {previewSrc && (
        <FilePreviewModal
          src={previewSrc}
          fileName={message.metadata?.fileName || 'Preview'}
          mimeType={message.metadata?.mimeType}
          fileSize={message.metadata?.fileSize}
          onClose={() => setPreviewSrc(null)}
        />
      )}
    </div>
  );
}

function StreamingMarkdown({ text }: { text: string }) {
  const html = useMemo(() => {
    return md.render(text);
  }, [text]);

  return (
    <div
      className="text-sm prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
