import { useEffect } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { useCallStore } from '@/stores/call.store';
import type { CallAnswerData, CallIceCandidateData, CallEndedData, CallToggleData } from '@/types';

export default function CallController() {
  useEffect(() => {
    const socket = useChatStore.getState().socket;
    if (!socket) return;

    const handleAccepted = async (data: CallAnswerData) => {
      const pc = useCallStore.getState().peerConnection;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        useCallStore.getState()._setRemoteDescriptionSet(true);
        await useCallStore.getState()._flushPendingCandidates(pc);
        useCallStore.getState()._setStatus('connected');
      } catch (err) {
        console.error('Failed to handle answer:', err);
      }
    };

    const handleIceCandidate = async (data: CallIceCandidateData) => {
      const store = useCallStore.getState();
      const pc = store.peerConnection;
      if (!pc || !data.candidate) return;

      if (!store.remoteDescriptionSet) {
        // Buffer: remoteDescription not yet set — cache until flush
        store._addPendingCandidate(data.candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch {
        // Ignore ICE candidate errors (common race condition)
      }
    };

    const handleEnded = (data: CallEndedData) => {
      const store = useCallStore.getState();
      if (store.status === 'idle') return;
      if (data.userId !== store.peer?.id) return;
      store._cleanup();
    };

    const handleToggle = (data: CallToggleData) => {
      useCallStore.getState()._handleRemoteToggle(data.type, data.enabled);
    };

    socket.on('call:accepted', handleAccepted);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:ended', handleEnded);
    socket.on('call:toggle', handleToggle);

    return () => {
      socket.off('call:accepted', handleAccepted);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:ended', handleEnded);
      socket.off('call:toggle', handleToggle);
    };
  }, []);

  return null;
}
