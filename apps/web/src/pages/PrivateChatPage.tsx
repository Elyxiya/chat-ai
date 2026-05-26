import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { ChatMessage } from '@/types';
import MessageBubble from '@/components/MessageBubble/MessageBubble';
import VirtualizedMessageList from '@/components/VirtualizedMessageList/VirtualizedMessageList';
import FileUploadPanel from '@/components/FileUpload/FileUploadPanel';
import ForwardModal from '@/components/ForwardModal';
import GroupDetailPanel from '@/components/GroupDetailPanel';
import { chatApi, uploadApi } from '@/api/client';

export default function PrivateChatPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { user } = useAuthStore();
  const {
    sessions,
    activeSessionId,
    messages,
    typingUsers,
    setActiveSession,
    loadMessages,
    sendMessage,
    sendFileMessage,
    sendTyping,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwardMsgId, setForwardMsgId] = useState<string | null>(null);
  const [showGroupDetail, setShowGroupDetail] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const session = sessions.find((s) => s.id === sessionId);
  const sessionMessages = useMemo(() => messages[sessionId || ''] || [], [messages, sessionId]);

  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSession(sessionId);
      loadMessages(sessionId);
    }
  }, [sessionId, activeSessionId, setActiveSession, loadMessages]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (sessionId) sendTyping(sessionId, true);
    typingTimeoutRef.current = setTimeout(() => {
      if (sessionId) sendTyping(sessionId, false);
    }, 2000);
  }, [sessionId, sendTyping]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !sessionId) return;
    const content = input.trim();
    if (replyTo) {
      // Send with reply via socket — metadata carries replyToId
      const { socket } = useChatStore.getState();
      socket?.emit('message', {
        type: 0, // TEXT
        data: { sessionId, content, contentType: 'text', replyToId: replyTo.id },
        timestamp: Date.now(),
      });
    } else {
      sendMessage(sessionId, content);
    }
    setInput('');
    setReplyTo(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(sessionId, false);
  }, [input, replyTo, sessionId, sendMessage, sendTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (!sessionId) return;
    for (const file of files) {
      try {
        const isImage = file.type.startsWith('image/');
        const setProgress = (_pct: number) => {
          // Progress tracking handled by uploadApi internally
        };
        const res: any = await (isImage
          ? uploadApi.uploadImage(file, setProgress)
          : uploadApi.uploadFile(file, setProgress));
        const url = res.data?.url || res.url;
        sendFileMessage(sessionId, url, isImage ? 'image' : 'file', file.name, file.size);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  }, [sessionId, sendFileMessage]);

  const typingUsersList = sessionId ? typingUsers[sessionId] || [] : [];
  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyTo(msg);
  }, []);

  const handleForward = useCallback((msgId: string) => {
    setForwardMsgId(msgId);
  }, []);

  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await chatApi.addReaction(messageId, emoji);
      // Update local store immediately so sender sees reaction right away
      if (sessionId) {
        useChatStore.getState().addMessageReaction(sessionId, messageId, {
          id: `${messageId}_${user?.id}_${emoji}`,
          emoji,
          userId: user?.id || '',
          messageId,
          createdAt: new Date().toISOString(),
        });
      }
      // Broadcast to other session members via socket
      const socket = useChatStore.getState().socket;
      socket?.emit('reaction', { messageId, sessionId, emoji });
    } catch { /* ignore */ }
  }, [sessionId, user?.id]);

  const bookmarkedIds = useMemo(() => {
    const set = new Set<string>();
    for (const msg of sessionMessages) {
      if (msg.reactions?.some((r) => r.userId === user?.id)) {
        // bookmarks tracked separately — this is for reference
      }
    }
    return set;
  }, [sessionMessages, user?.id]);

  const otherMembers = session?.members.filter((m) => m.user.id !== user?.id) || [];
  const chatName = otherMembers.length === 1
    ? otherMembers[0].user.nickname || otherMembers[0].user.username
    : session?.name || 'Chat';

  return (
    <>
      {/* Chat header */}
      <header className="h-14 px-4 border-b border-border flex items-center gap-3 bg-surface">
        {session?.sessionType === 'group' ? (
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
            {chatName[0]?.toUpperCase()}
          </div>
        ) : otherMembers.length === 1 ? (
          <img
            src={otherMembers[0].user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${otherMembers[0].user.username}`}
            alt={otherMembers[0].user.username}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{chatName}</h2>
          {otherMembers.length > 0 && (
            <p className="text-xs text-text-secondary truncate">
              {otherMembers.map((m) => m.user.username).join(', ')}
            </p>
          )}
        </div>
        {session?.sessionType === 'group' && (
          <button
            onClick={() => setShowGroupDetail(true)}
            className="p-2 hover:bg-border rounded-lg transition-colors"
            title="Group info"
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </header>

      {/* Messages — virtualized */}
      <VirtualizedMessageList
        messages={sessionMessages}
        userId={user?.id}
        onReply={handleReply}
        onForward={handleForward}
        onReaction={handleReaction}
        typingIndicator={
          typingUsersList.length > 0 ? (
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 bg-text-secondary rounded-full animate-typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <span>{typingUsersList.map((u) => u.username).join(', ')} typing...</span>
            </div>
          ) : undefined
        }
      />

      {/* Input */}
      <div className="border-t border-border bg-surface">
        {/* Reply bar */}
        {replyTo && (
          <div className="px-4 py-2 flex items-center gap-2 bg-bg/50 border-b border-border">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <svg className="w-4 h-4 text-text-secondary flex-shrink-0 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-primary-600">{replyTo.sender?.nickname || replyTo.sender?.username || 'Message'}</p>
                <p className="text-xs text-text-secondary truncate">{replyTo.content.slice(0, 100)}</p>
              </div>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-border rounded transition-colors">
              <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="p-4 flex items-end gap-2">
          <FileUploadPanel onUpload={handleFileUpload} />
          <textarea
            className="input-field resize-none max-h-32"
            rows={1}
            placeholder={replyTo ? 'Reply to message...' : 'Type a message...'}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleInputChange(e.target.value);
            }}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="btn-primary px-4 py-2 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {forwardMsgId && (
        <ForwardModal
          messageId={forwardMsgId}
          onClose={() => setForwardMsgId(null)}
          onDone={() => {}}
        />
      )}
      {session && (
        <GroupDetailPanel
          session={session}
          isOpen={showGroupDetail}
          onClose={() => setShowGroupDetail(false)}
        />
      )}
    </>
  );
}
