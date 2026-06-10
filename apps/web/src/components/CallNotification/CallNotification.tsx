import { useEffect, useState } from 'react';
import { useCallStore } from '@/stores/call.store';
import { useChatStore } from '@/stores/chat.store';
import type { CallOfferData } from '@/types';

export default function CallNotification() {
  const [incoming, setIncoming] = useState<CallOfferData | null>(null);
  const [countdown, setCountdown] = useState(30);
  const { acceptCall, rejectCall } = useCallStore();
  const status = useCallStore((s) => s.status);

  useEffect(() => {
    const socket = useChatStore.getState().socket;
    if (!socket) return;

    const handler = (data: CallOfferData) => {
      setIncoming(data);
      useCallStore.getState()._setStatus('ringing');
      useCallStore.getState()._setCallType(data.callType);
      useCallStore.getState().setPeer({
        id: data.callerId,
        username: data.callerName,
        avatarUrl: data.callerAvatar,
      });
      setCountdown(30);
    };
    socket.on('call:incoming', handler);
    return () => { socket.off('call:incoming', handler); };
  }, []);

  useEffect(() => {
    if (status === 'connected') {
      setIncoming(null);
    }
  }, [status]);

  useEffect(() => {
    if (!incoming || status !== 'ringing') return;
    if (countdown <= 0) {
      rejectCall(incoming.callerId);
      setIncoming(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, incoming, status, rejectCall]);

  // Also listen for call:ended while ringing
  useEffect(() => {
    const socket = useChatStore.getState().socket;
    if (!socket) return;
    const endHandler = (data: { userId: string }) => {
      if (data.userId !== incoming?.callerId) return;
      setIncoming(null);
    };
    socket.on('call:ended', endHandler);
    return () => { socket.off('call:ended', endHandler); };
  }, []);

  if (!incoming || status !== 'ringing') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-2xl shadow-2xl p-8 w-80 flex flex-col items-center gap-6 animate-slide-up">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-3xl overflow-hidden">
          {incoming.callerAvatar ? (
            <img src={incoming.callerAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary-600 font-bold text-2xl">
              {incoming.callerName[0]?.toUpperCase()}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="text-center">
          <h3 className="text-lg font-semibold">{incoming.callerName}</h3>
          <p className="text-sm text-text-secondary mt-1">
            {incoming.callType === 'video' ? 'Video call' : 'Voice call'}
          </p>
        </div>

        {/* Timer */}
        <p className="text-xs text-text-secondary">{countdown}s</p>

        {/* Buttons */}
        <div className="flex gap-6">
          <button
            onClick={() => {
              rejectCall(incoming.callerId);
              setIncoming(null);
            }}
            className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
            title="Decline"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l-4 4m0 0l-4 4m4-4l4-4m-4 4l-4-4" />
            </svg>
          </button>
          <button
            onClick={() => acceptCall(incoming)}
            className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg animate-pulse"
            title="Accept"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        </div>

        {/* Call type indicator */}
        <p className="text-xs text-text-secondary flex items-center gap-1">
          {incoming.callType === 'video' ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          )}
          {incoming.callType === 'video' ? 'Video call' : 'Voice call'} · Incoming
        </p>
      </div>
    </div>
  );
}
