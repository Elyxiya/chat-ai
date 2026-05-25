import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import MessageBubble from '@/components/MessageBubble/MessageBubble';
import FileUploadPanel from '@/components/FileUpload/FileUploadPanel';
import { uploadApi } from '@/api/client';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const session = sessions.find((s) => s.id === sessionId);
  const sessionMessages = useMemo(() => messages[sessionId || ''] || [], [messages, sessionId]);

  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSession(sessionId);
      loadMessages(sessionId);
    }
  }, [sessionId, activeSessionId, setActiveSession, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionMessages]);

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
    sendMessage(sessionId, input.trim());
    setInput('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(sessionId, false);
  }, [input, sessionId, sendMessage, sendTyping]);

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
        const res: any = await (isImage ? uploadApi.uploadImage(file) : uploadApi.uploadFile(file));
        const url = res.data?.url || res.url;
        sendFileMessage(sessionId, url, isImage ? 'image' : 'file', file.name, file.size);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  }, [sessionId, sendFileMessage]);

  const typingUsersList = sessionId ? typingUsers[sessionId] || [] : [];
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
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {sessionMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === user?.id}
          />
        ))}
        {typingUsersList.length > 0 && (
          <div className="flex items-center gap-2 text-text-secondary text-sm px-4">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 bg-text-secondary rounded-full animate-typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <span>{typingUsersList.map((u) => u.username).join(', ')} typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-surface">
        <div className="flex items-end gap-2">
          <FileUploadPanel onUpload={handleFileUpload} />
          <textarea
            className="input-field resize-none max-h-32"
            rows={1}
            placeholder="Type a message..."
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
    </>
  );
}
