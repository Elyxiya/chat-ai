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
  onEdit?: (msg: ChatMessage) => void;
  bookmarkedIds?: Set<string>;
  sessionMembersCount?: number;
  batchMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (messageId: string) => void;
  /** 上滑加载更早的消息，返回新增条数 */
  onLoadMore?: (before: string) => Promise<number>;
  /** 是否正在加载历史消息（显示加载提示） */
  isLoadingMore?: boolean;
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

export default function VirtualizedMessageList({
  messages, userId, typingIndicator, onReply, onForward, onBookmark,
  onReaction, onEdit, bookmarkedIds, sessionMembersCount, batchMode,
  selectedIds, onToggleSelect, onLoadMore, isLoadingMore,
}: VirtualizedMessageListProps) {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const sizeMap = useRef<Map<string, number>>(new Map());
  const prevLengthRef = useRef(messages.length);
  const prevFirstIdRef = useRef<string | null>(messages[0]?.id || null);
  const rafRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const firstMsgIdRef = useRef<string | null>(null);

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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        listRef.current?.scrollToItem(messages.length - 1, 'end');
        rafRef.current = null;
      });
    }
  }, [messages.length, isAtBottom]);

  // Only add new messages to sizeMap, never clear
  useEffect(() => {
    for (const msg of messages) {
      if (!sizeMap.current.has(msg.id)) {
        sizeMap.current.set(msg.id, getItemHeight(msg));
      }
    }
  }, [messages]);

  const getSize = useCallback((index: number) => {
    const msg = messages[index];
    if (!msg) return ROW_ESTIMATED_SIZE;
    if (!sizeMap.current.has(msg.id)) {
      sizeMap.current.set(msg.id, getItemHeight(msg));
    }
    return sizeMap.current.get(msg.id)!;
  }, [messages]);

  const totalContentHeight = useMemo(() => {
    return messages.reduce((sum, _, i) => sum + getSize(i), 0);
  }, [messages, getSize]);

  // ── 当历史消息被 prepend 时补偿滚动偏移 ─────────────────────────
  useEffect(() => {
    const currentFirstId = messages[0]?.id || null;
    if (currentFirstId && currentFirstId !== prevFirstIdRef.current) {
      // 第一条消息变了，说明有历史消息被 prepend
      const addedCount = messages.findIndex((m) => m.id === prevFirstIdRef.current);
      if (addedCount > 0) {
        let addedHeight = 0;
        for (let i = 0; i < addedCount && i < messages.length; i++) {
          addedHeight += sizeMap.current.get(messages[i].id) ?? ROW_ESTIMATED_SIZE;
        }
        requestAnimationFrame(() => {
          listRef.current?.scrollTo(scrollOffsetRef.current + addedHeight);
        });
      }
      prevFirstIdRef.current = currentFirstId;
    }
  }, [messages]);

  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    scrollOffsetRef.current = scrollOffset;
    const bottom = totalContentHeight - scrollOffset - containerHeight;
    setIsAtBottom(bottom < SCROLL_BOTTOM_THRESHOLD);

    // 滚到顶部附近时触发历史加载
    if (scrollOffset < 50 && onLoadMore && !loadingMoreRef.current && messages.length > 0) {
      const firstReal = messages.find((m) => !m.id.startsWith('temp-'));
      if (firstReal && firstReal.id !== firstMsgIdRef.current) {
        firstMsgIdRef.current = firstReal.id;
        loadingMoreRef.current = true;
        onLoadMore(firstReal.createdAt).then(() => {
          loadingMoreRef.current = false;
        });
      }
    }
  }, [containerHeight, totalContentHeight, onLoadMore, messages]);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
      setIsAtBottom(true);
    }
  }, [messages.length]);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const msg = messages[index];
    const isSelected = selectedIds?.has(msg.id);
    return (
      <div
        style={style}
        className={`px-5 flex items-start gap-2 ${batchMode ? 'cursor-pointer' : ''}`}
        onClick={batchMode && onToggleSelect ? () => onToggleSelect(msg.id) : undefined}
      >
        {batchMode && (
          <div className="flex-shrink-0 pt-4">
            <input
              type="checkbox"
              checked={!!isSelected}
              readOnly
              className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <MessageBubble
            message={msg}
            isOwn={msg.senderId === userId}
            onReply={batchMode ? undefined : (onReply ? () => onReply(msg) : undefined)}
            onForward={batchMode ? undefined : (onForward ? () => onForward(msg.id) : undefined)}
            onBookmark={batchMode ? undefined : (onBookmark ? () => onBookmark(msg.id) : undefined)}
            onReaction={batchMode ? undefined : (onReaction ? (emoji) => onReaction(msg.id, emoji) : undefined)}
            onEdit={batchMode ? undefined : (onEdit ? () => onEdit(msg) : undefined)}
            bookmarked={bookmarkedIds?.has(msg.id)}
            sessionMembersCount={sessionMembersCount}
          />
        </div>
      </div>
    );
  }, [messages, userId, onReply, onForward, onBookmark, onReaction, onEdit, bookmarkedIds, sessionMembersCount, batchMode, selectedIds, onToggleSelect]);

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
