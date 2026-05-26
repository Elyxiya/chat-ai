import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { VariableSizeList as List } from 'react-window';
import { ChatMessage } from '@/types';
import MessageBubble from '@/components/MessageBubble/MessageBubble';

interface VirtualizedMessageListProps {
  messages: ChatMessage[];
  userId?: string | null;
  typingIndicator?: React.ReactNode;
  onReply?: (msg: ChatMessage) => void;
  onForward?: (messageId: string) => void;
  onBookmark?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  bookmarkedIds?: Set<string>;
}

const ROW_ESTIMATED_SIZE = 120;
const SCROLL_BOTTOM_THRESHOLD = 20;

function getItemHeight(message: ChatMessage): number {
  if (message.contentType === 'image' || message.contentType === 'video') return 360;
  if (message.contentType === 'file') return 130;
  if (message.contentType === 'audio') return 110;
  if (message.contentType === 'ai_response') return Math.max(140, Math.ceil(message.content.length / 100) * 60 + 40);
  const lines = message.content.split('\n').length;
  return Math.max(110, lines * 24 + 80);
}

export default function VirtualizedMessageList({ messages, userId, typingIndicator, onReply, onForward, onBookmark, onReaction, bookmarkedIds }: VirtualizedMessageListProps) {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const sizeMap = useRef<{ [key: number]: number }>({});
  const prevLengthRef = useRef(messages.length);
  const rafRef = useRef<number | null>(null);

  // Observe container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll to bottom when new messages arrive and user is at bottom
  useEffect(() => {
    const prevLen = prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (messages.length > prevLen && isAtBottom && listRef.current) {
      // Reset size cache so react-window re-measures
      // Then scroll in the next frame after rendering
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        listRef.current?.scrollToItem(messages.length - 1, 'end');
        rafRef.current = null;
      });
    }
  }, [messages.length, isAtBottom]);

  // Reset size cache when messages change
  useEffect(() => {
    sizeMap.current = {};
  }, [messages]);

  const getSize = useCallback((index: number) => {
    if (!sizeMap.current[index]) {
      sizeMap.current[index] = getItemHeight(messages[index]);
    }
    return sizeMap.current[index];
  }, [messages]);

  const totalContentHeight = useMemo(() => {
    return messages.reduce((sum, _, i) => sum + getSize(i), 0);
  }, [messages, getSize]);

  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    const bottom = totalContentHeight - scrollOffset - containerHeight;
    setIsAtBottom(bottom < SCROLL_BOTTOM_THRESHOLD);
  }, [containerHeight, totalContentHeight]);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
      setIsAtBottom(true);
    }
  }, [messages.length]);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const msg = messages[index];
    return (
      <div style={style} className="px-5">
        <MessageBubble
          message={msg}
          isOwn={msg.senderId === userId}
          onReply={onReply ? () => onReply(msg) : undefined}
          onForward={onForward ? () => onForward(msg.id) : undefined}
          onBookmark={onBookmark ? () => onBookmark(msg.id) : undefined}
          onReaction={onReaction ? (emoji) => onReaction(msg.id, emoji) : undefined}
          bookmarked={bookmarkedIds?.has(msg.id)}
        />
      </div>
    );
  }, [messages, userId, onReply, onForward, onBookmark, onReaction, bookmarkedIds]);

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      {containerHeight > 0 && messages.length > 0 ? (
        <>
          <List
            ref={listRef}
            height={containerHeight}
            width={containerWidth}
            itemCount={messages.length}
            itemSize={getSize}
            estimatedItemSize={ROW_ESTIMATED_SIZE}
            onScroll={handleScroll}
            overscanCount={5}
          >
            {Row}
          </List>

          {typingIndicator && (
            <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-bg via-bg/80 to-transparent">
              {typingIndicator}
            </div>
          )}

          {/* Scroll to bottom button */}
          {!isAtBottom && messages.length > 3 && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-primary-600 text-white text-sm rounded-full shadow-lg hover:bg-primary-700 transition-colors z-10"
            >
              ↓ New messages
            </button>
          )}
        </>
      ) : containerHeight > 0 ? (
        <div className="flex items-center justify-center h-full text-text-secondary text-sm">
          No messages yet
        </div>
      ) : null}
    </div>
  );
}
