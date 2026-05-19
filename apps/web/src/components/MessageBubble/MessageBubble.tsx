import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import { ChatMessage } from '@/types';
import { format } from 'date-fns';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: MessageBubbleProps) {
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
        <img
          src={message.content}
          alt="Shared image"
          className="max-w-[300px] max-h-[300px] rounded-lg"
          loading="lazy"
        />
      );
    }

    if (message.contentType === 'ai_response') {
      return <StreamingMarkdown text={message.content} />;
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
  }, [message]);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
        {!isOwn && message.sender && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <img
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
        </div>
      </div>
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
