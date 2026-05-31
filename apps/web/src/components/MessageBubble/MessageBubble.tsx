import { useMemo, useState, useRef, useEffect } from 'react';
import MarkdownIt from 'markdown-it';
import { ChatMessage } from '@/types';
import { format } from 'date-fns';
import { chatApi } from '@/api/client';
import FilePreviewModal from '../FilePreviewModal/FilePreviewModal';
import LazyImage from '../LazyImage/LazyImage';
import ReadReceiptPanel from '../ReadReceiptPanel/ReadReceiptPanel';
import EmojiPicker from '../EmojiPicker/EmojiPicker';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onReaction?: (emoji: string) => void;
  onReply?: () => void;
  onForward?: () => void;
  onBookmark?: () => void;
  onEdit?: () => void;
  bookmarked?: boolean;
  sessionMembersCount?: number;
}

export default function MessageBubble({ message, isOwn, onReaction, onReply, onForward, onBookmark, onEdit, bookmarked, sessionMembersCount }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showReadReceipts, setShowReadReceipts] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [showBookmarkDialog, setShowBookmarkDialog] = useState(false);
  const [bookmarkTags, setBookmarkTags] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowReactions(false);
        setShowBookmarkDialog(false);
      }
    };
    if (showMenu || showBookmarkDialog) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu, showBookmarkDialog]);

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

    return <p className="text-sm whitespace-pre-wrap break-words">{renderContentWithMentions(message.content)}</p>;
  }, [message]);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group relative py-1`}>
      <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`} ref={menuRef}>
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
          className={`px-3.5 py-2.5 rounded-xl ${
            isOwn
              ? 'bg-primary-600 text-white rounded-br-sm'
              : message.contentType === 'system'
                ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm'
                : 'bg-surface border border-border rounded-bl-sm'
          }`}
        >
          {content}
        </div>

        <div className={`flex items-center gap-2 mt-1 px-1 ${isOwn ? 'justify-end' : ''}`}>
          <span className="text-xs text-text-secondary">
            {format(new Date(message.createdAt), 'HH:mm')}
            {message.editCount && message.editCount > 0 ? ' · edited' : ''}
          </span>
          {isOwn && sessionMembersCount && sessionMembersCount > 2 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowReadReceipts(true); }}
              className="text-xs text-text-secondary hover:text-primary-600 transition-colors"
            >
              Read
            </button>
          )}
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
              onClick={() => { if (onReply) { onReply(); } setShowMenu(false); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg flex items-center gap-2"
            >
              <span>Reply</span>
            </button>
            <button
              onClick={() => { if (onForward) { onForward(); } setShowMenu(false); }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg flex items-center gap-2"
            >
              <span>Forward</span>
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                if (bookmarked) {
                  if (onBookmark) onBookmark();
                } else {
                  setShowBookmarkDialog(true);
                }
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg flex items-center gap-2"
            >
              <span>{bookmarked ? 'Remove Bookmark' : 'Bookmark'}</span>
            </button>
            {isOwn && onEdit && (
              <button
                onClick={() => { if (onEdit) { onEdit(); } setShowMenu(false); }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg flex items-center gap-2"
              >
                <span>Edit</span>
              </button>
            )}
          </div>
        )}

        {/* Reaction picker */}
        {showReactions && (
          <div className="absolute z-10 mt-1">
            <EmojiPicker
              onSelect={(emoji) => { if (onReaction) { onReaction(emoji); } setShowReactions(false); }}
              onClose={() => setShowReactions(false)}
            />
          </div>
        )}

        {/* Bookmark dialog */}
        {showBookmarkDialog && (
          <div className="absolute z-10 mt-1 right-0">
            <div className="bg-surface border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
              <p className="text-xs font-medium text-text-secondary mb-2">Add tags (optional)</p>
              <input
                type="text"
                value={bookmarkTags}
                onChange={(e) => setBookmarkTags(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const tags = bookmarkTags.split(',').map((t) => t.trim()).filter(Boolean);
                    if (tags.length > 0) {
                      chatApi.toggleBookmark(message.id).then(() => {
                        if (tags.length > 0) {
                          chatApi.updateBookmark(message.id, { tags });
                        }
                        if (onBookmark) onBookmark();
                      });
                    } else {
                      if (onBookmark) onBookmark();
                    }
                    setShowBookmarkDialog(false);
                    setBookmarkTags('');
                  }
                }}
                placeholder="work, important, ..."
                className="w-full px-2 py-1.5 text-sm bg-bg border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              />
              <p className="text-[10px] text-text-secondary mt-1">Separate tags with commas, press Enter to save</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => {
                    const tags = bookmarkTags.split(',').map((t) => t.trim()).filter(Boolean);
                    chatApi.toggleBookmark(message.id).then(() => {
                      if (tags.length > 0) {
                        chatApi.updateBookmark(message.id, { tags });
                      }
                      if (onBookmark) onBookmark();
                    });
                    setShowBookmarkDialog(false);
                    setBookmarkTags('');
                  }}
                  className="px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    if (onBookmark) onBookmark();
                    setShowBookmarkDialog(false);
                    setBookmarkTags('');
                  }}
                  className="px-3 py-1 text-xs text-text-secondary hover:text-text transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => {
                    setShowBookmarkDialog(false);
                    setBookmarkTags('');
                  }}
                  className="px-3 py-1 text-xs text-text-secondary hover:text-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showReadReceipts && (
        <ReadReceiptPanel
          messageId={message.id}
          isOpen={showReadReceipts}
          onClose={() => setShowReadReceipts(false)}
        />
      )}
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

function renderContentWithMentions(content: string): React.ReactNode {
  // Split by @all and @everyone mentions and wrap them in highlighted spans
  const parts = content.split(/(\B@(?:all|everyone)\b)/gi);
  if (parts.length === 1) return content;
  return parts.map((part, i) =>
    /^\B@(all|everyone)\b$/i.test(part)
      ? <span key={i} className="inline-block px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-semibold">{part}</span>
      : part,
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
