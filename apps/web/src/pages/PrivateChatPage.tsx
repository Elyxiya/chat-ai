import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { useCallStore } from '@/stores/call.store';
import { ChatMessage } from '@/types';
import CallController from '@/components/CallController/CallController';
import CallNotification from '@/components/CallNotification/CallNotification';
import CallWindow from '@/components/CallWindow/CallWindow';
import VirtualizedMessageList from '@/components/VirtualizedMessageList/VirtualizedMessageList';
import FileUploadPanel from '@/components/FileUpload/FileUploadPanel';
import ForwardModal from '@/components/ForwardModal';
import GroupDetailPanel from '@/components/GroupDetailPanel';
import RichTextEditor from '@/components/RichTextEditor/RichTextEditor';
import { chatApi, uploadApi } from '@/api/client';

export default function PrivateChatPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    sessions,
    activeSessionId,
    messages,
    messagesError,
    typingUsers,
    setActiveSession,
    loadMessages,
    sendMessage,
    sendFileMessage,
    sendTyping,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [editInput, setEditInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwardMsgId, setForwardMsgId] = useState<string | null>(null);
  const [showGroupDetail, setShowGroupDetail] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const loadMoreMessages = useChatStore((s) => s.loadMoreMessages);
  const session = sessions.find((s) => s.id === sessionId);
  const sessionMessages = useMemo(() => messages[sessionId || ''] || [], [messages, sessionId]);

  // Load messages: on session change (switch) AND on re-entry (return from another page)
  const loadedSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSession(sessionId);
    }
    if (sessionId && loadedSessionRef.current !== sessionId) {
      loadMessages(sessionId);
      loadedSessionRef.current = sessionId;
    }
  }, [sessionId, activeSessionId, setActiveSession, loadMessages]);

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

  const handleEditSubmit = useCallback(async (messageId: string, content: string) => {
    if (!sessionId || !content.trim()) { setEditingMessage(null); return; }
    await useChatStore.getState().editMessage(sessionId, messageId, content.trim());
    setEditingMessage(null);
  }, [sessionId]);

  const handleEditCancel = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleEdit = useCallback((msg: ChatMessage) => {
    setEditInput(msg.content);
    setEditingMessage(msg);
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) handleEditSubmit(editingMessage.id, editInput);
    }
    if (e.key === 'Escape') {
      handleEditCancel();
    }
  }, [editingMessage, editInput, handleEditSubmit, handleEditCancel]);

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
    : session?.name || t('nav.chats');

  return (
    <>
      {/* Chat header */}
      <header className="h-14 px-4 border-b border-border flex items-center gap-3 bg-surface">
        {session?.sessionType === 'group' ? (
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
            {chatName[0]?.toUpperCase()}
          </div>
        ) : session?.sessionType === 'channel' ? (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
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
          <h2 className="font-semibold text-sm truncate flex items-center gap-2">
            {chatName}
            {session?.sessionType === 'channel' && (
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded font-normal">{t('chat.channel')}</span>
            )}
          </h2>
          {session?.sessionType === 'channel' ? (
            <p className="text-xs text-text-secondary truncate">
              {session._count?.members || session.members?.length || 0} {t('chat.subscribers')}
            </p>
          ) : otherMembers.length > 0 ? (
            <p className="text-xs text-text-secondary truncate">
              {otherMembers.map((m) => m.user.username).join(', ')}
            </p>
          ) : null}
        </div>
        {session?.sessionType === 'group' && (
          <button
            onClick={() => setShowGroupDetail(true)}
            className="p-2 hover:bg-border rounded-lg transition-colors"
            title={t('chat.groupInfo')}
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
        {/* Call buttons for private chats */}
        {session?.sessionType === 'private' && otherMembers.length === 1 && (
          <>
            <button
              onClick={() => {
                const peer = otherMembers[0].user;
                useCallStore.getState().startCall(peer.id, peer.nickname || peer.username, peer.avatarUrl, 'audio');
              }}
              className="p-2 hover:bg-border rounded-lg transition-colors"
              title={t('chat.voiceCall')}
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
            <button
              onClick={() => {
                const peer = otherMembers[0].user;
                useCallStore.getState().startCall(peer.id, peer.nickname || peer.username, peer.avatarUrl, 'video');
              }}
              className="p-2 hover:bg-border rounded-lg transition-colors"
              title={t('chat.videoCall')}
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </>
        )}
        {session?.sessionType === 'channel' && session.myRole !== 'owner' && (
          <button
            onClick={async () => {
              if (session.myRole === 'member') {
                await chatApi.unsubscribeChannel(session.id);
                navigate('/chat');
              }
            }}
            className="p-2 hover:bg-border rounded-lg transition-colors"
            title={t('chat.unsubscribe')}
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {/* Channel settings gear — visible to owner/admin */}
        {session?.sessionType === 'channel' && (session.myRole === 'owner' || session.myRole === 'admin') && (
          <button
            onClick={() => navigate(`/channels/${session.id}/settings`)}
            className="p-2 hover:bg-border rounded-lg transition-colors"
            title={t('chat.channelSettings')}
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
        {/* Batch mode toggle — not in channel readonly mode */}
        {session?.sessionType !== 'channel' && (
          <button
            onClick={() => useChatStore.getState().toggleBatchMode()}
            className={`p-2 hover:bg-border rounded-lg transition-colors ${useChatStore.getState().batchMode ? 'text-primary-600 bg-primary-50' : ''}`}
            title={t('chat.selectMessages')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
        )}
      </header>

      {/* Batch toolbar */}
      {useChatStore.getState().batchMode && (
        <div className="px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-border flex items-center gap-3">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {t('chat.selected')} {useChatStore.getState().selectedMessageIds.size}
          </span>
          <button
            onClick={() => {
              const selectedIds = Array.from(useChatStore.getState().selectedMessageIds);
              if (selectedIds.length > 0) {
                setForwardMsgId('batch');
              }
            }}
            disabled={useChatStore.getState().selectedMessageIds.size === 0}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {t('chat.batchForward')}
          </button>
          <button
            onClick={async () => {
              const selectedIds = Array.from(useChatStore.getState().selectedMessageIds);
              if (selectedIds.length === 0) return;
              await chatApi.batchDeleteMessages(selectedIds, 'everyone');
              useChatStore.getState().clearSelection();
            }}
            disabled={useChatStore.getState().selectedMessageIds.size === 0}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {t('chat.batchDelete')}
          </button>
          <button
            onClick={() => useChatStore.getState().clearSelection()}
            className="px-3 py-1 text-sm border border-border rounded-lg hover:bg-border transition-colors ml-auto"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* Error banner */}
      {messagesError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-600 dark:text-red-400 flex-1">{messagesError}</span>
          <button
            onClick={() => sessionId && loadMessages(sessionId)}
            className="text-sm text-red-600 dark:text-red-400 underline hover:no-underline flex-shrink-0"
          >
            {t('chat.retry')}
          </button>
        </div>
      )}

      {/* Messages — virtualized */}
      <VirtualizedMessageList
        messages={sessionMessages}
        userId={user?.id}
        onReply={handleReply}
        onForward={handleForward}
        onReaction={handleReaction}
        onEdit={handleEdit}
        sessionMembersCount={session?.members?.length || 0}
        batchMode={useChatStore.getState().batchMode}
        selectedIds={useChatStore.getState().selectedMessageIds}
        onToggleSelect={(id) => useChatStore.getState().toggleMessageSelection(id)}
        onLoadMore={async (before: string) => {
          if (!sessionId) return 0;
          setIsLoadingMore(true);
          const count = await loadMoreMessages(sessionId, before);
          setIsLoadingMore(false);
          return count;
        }}
        isLoadingMore={isLoadingMore}
        typingIndicator={
          typingUsersList.length > 0 ? (
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 bg-text-secondary rounded-full animate-typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <span>{typingUsersList.map((u) => u.username).join(', ')} {t('chat.typing')}</span>
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
                <p className="text-xs font-medium text-primary-600">{replyTo.sender?.nickname || replyTo.sender?.username || t('common.send')}</p>
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
          {editingMessage ? (
            <>
              <textarea
                className="input-field resize-none max-h-32"
                rows={1}
                placeholder={t('chat.editMessagePlaceholder')}
                value={editInput}
                onChange={(e) => setEditInput(e.target.value)}
                onKeyDown={handleEditKeyDown}
                autoFocus
              />
              <button
                onClick={() => handleEditSubmit(editingMessage.id, editInput)}
                disabled={!editInput.trim()}
                className="btn-primary px-4 py-2 flex-shrink-0 text-sm"
              >
                {t('common.save')}
              </button>
              <button
                onClick={handleEditCancel}
                className="px-4 py-2 flex-shrink-0 text-sm border border-border rounded-lg hover:bg-border transition-colors"
              >
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <>
              <FileUploadPanel onUpload={handleFileUpload} />
              <div className="flex-1 min-w-0">
                <RichTextEditor
                  value={input}
                  onChange={(text) => {
                    setInput(text);
                    // Typing indicator
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    if (sessionId) sendTyping(sessionId, true);
                    typingTimeoutRef.current = setTimeout(() => {
                      if (sessionId) sendTyping(sessionId, false);
                    }, 2000);
                  }}
                  onSend={handleSend}
                  placeholder={replyTo ? t('chat.replyTo') : t('chat.typeMessage')}
                  autoFocus
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="btn-primary px-4 py-2 flex-shrink-0 self-end"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {forwardMsgId === 'batch' && (
        <ForwardModal
          messageIds={Array.from(useChatStore.getState().selectedMessageIds)}
          onClose={() => { setForwardMsgId(null); useChatStore.getState().clearSelection(); }}
          onDone={() => {}}
        />
      )}
      {forwardMsgId && forwardMsgId !== 'batch' && (
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

      {/* Call UI */}
      <CallController />
      <CallNotification />
      <CallWindow />
    </>
  );
}
