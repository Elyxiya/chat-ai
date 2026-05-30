import { create } from 'zustand';
import type { CallStatus, CallType, CallPeer, CallOfferData } from '@/types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface CallState {
  status: CallStatus;
  callType: CallType;
  peer: CallPeer | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isMicMuted: boolean;
  isCameraOff: boolean;

  // Actions
  setPeer: (peer: CallPeer) => void;
  startCall: (peerId: string, peerName: string, peerAvatar: string | null | undefined, type: CallType) => Promise<void>;
  acceptCall: (offerData: CallOfferData) => Promise<void>;
  rejectCall: (targetUserId: string) => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;

  // Internal
  _setLocalStream: (stream: MediaStream | null) => void;
  _setRemoteStream: (stream: MediaStream | null) => void;
  _setPeerConnection: (pc: RTCPeerConnection | null) => void;
  _setStatus: (status: CallStatus) => void;
  _setCallType: (type: CallType) => void;
  _handleRemoteToggle: (type: 'audio' | 'video', enabled: boolean) => void;
  _cleanup: () => void;
}

async function getLocalMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  return stream;
}

function createPeerConnection(
  store: CallState,
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onTrack: (stream: MediaStream) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  pc.ontrack = (event) => {
    if (event.streams[0]) {
      onTrack(event.streams[0]);
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      store.endCall();
    }
  };

  return pc;
}

export const useCallStore = create<CallState>((set, get) => ({
  status: 'idle',
  callType: 'video',
  peer: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMicMuted: false,
  isCameraOff: false,

  setPeer: (peer) => set({ peer }),

  startCall: async (peerId, peerName, peerAvatar, type) => {
    const state = get();
    if (state.status !== 'idle') return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video',
      };
      const localStream = await getLocalMedia(constraints);

      let onIceCandidateFn: (candidate: RTCIceCandidate) => void = () => {};
      let onTrackFn: (stream: MediaStream) => void = () => {};

      const pc = createPeerConnection(
        { ...state, endCall: get().endCall },
        (candidate) => onIceCandidateFn(candidate),
        (stream) => onTrackFn(stream),
      );

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      set({
        status: 'calling',
        callType: type,
        peer: { id: peerId, username: peerName, avatarUrl: peerAvatar },
        localStream,
        peerConnection: pc,
      });

      // Expose callbacks for CallController to wire up
      const socket = (await import('@/stores/chat.store')).useChatStore.getState().socket;
      socket?.emit('call:offer', {
        targetUserId: peerId,
        sdp: pc.localDescription,
        callType: type,
      });

      onIceCandidateFn = (candidate) => {
        socket?.emit('call:ice-candidate', { targetUserId: peerId, candidate });
      };

      onTrackFn = (stream) => {
        set({ remoteStream: stream });
      };
    } catch (err: unknown) {
      console.error('Failed to start call:', err);
      get()._cleanup();
    }
  },

  acceptCall: async (offerData) => {
    const state = get();
    if (state.status !== 'ringing') return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: offerData.callType === 'video',
      };
      const localStream = await getLocalMedia(constraints);

      let onIceCandidateFn: (candidate: RTCIceCandidate) => void = () => {};

      const pc = createPeerConnection(
        { ...state, endCall: get().endCall },
        (candidate) => onIceCandidateFn(candidate),
        (stream) => set({ remoteStream: stream }),
      );

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offerData.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      set({
        status: 'connected',
        localStream,
        peerConnection: pc,
      });

      const socket = (await import('@/stores/chat.store')).useChatStore.getState().socket;
      socket?.emit('call:answer', {
        targetUserId: offerData.callerId,
        sdp: pc.localDescription,
      });

      onIceCandidateFn = (candidate) => {
        socket?.emit('call:ice-candidate', { targetUserId: offerData.callerId, candidate });
      };
    } catch (err: unknown) {
      console.error('Failed to accept call:', err);
      get()._cleanup();
    }
  },

  rejectCall: (targetUserId) => {
    import('@/stores/chat.store').then(({ useChatStore }) => {
      useChatStore.getState().socket?.emit('call:reject', { targetUserId });
    });
    get()._cleanup();
  },

  endCall: () => {
    const { peer } = get();
    if (peer && peer.id) {
      import('@/stores/chat.store').then(({ useChatStore }) => {
        useChatStore.getState().socket?.emit('call:end', { targetUserId: peer.id });
      });
    }
    get()._cleanup();
  },

  toggleMic: () => {
    const { localStream, isMicMuted, peer } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicMuted;
      });
      set({ isMicMuted: !isMicMuted });
      if (peer) {
        import('@/stores/chat.store').then(({ useChatStore }) => {
          useChatStore.getState().socket?.emit('call:toggle', {
            targetUserId: peer.id,
            type: 'audio',
            enabled: isMicMuted,
          });
        });
      }
    }
  },

  toggleCamera: () => {
    const { localStream, isCameraOff, peer } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOff;
      });
      set({ isCameraOff: !isCameraOff });
      if (peer) {
        import('@/stores/chat.store').then(({ useChatStore }) => {
          useChatStore.getState().socket?.emit('call:toggle', {
            targetUserId: peer.id,
            type: 'video',
            enabled: isCameraOff,
          });
        });
      }
    }
  },

  _setLocalStream: (stream) => set({ localStream: stream }),
  _setRemoteStream: (stream) => set({ remoteStream: stream }),
  _setPeerConnection: (pc) => set({ peerConnection: pc }),
  _setStatus: (status) => set({ status }),
  _setCallType: (type) => set({ callType: type }),

  _handleRemoteToggle: (type, enabled) => {
    const { remoteStream } = get();
    if (!remoteStream) return;
    if (type === 'audio') {
      remoteStream.getAudioTracks().forEach((track) => { track.enabled = enabled; });
    } else {
      remoteStream.getVideoTracks().forEach((track) => { track.enabled = enabled; });
    }
  },

  _cleanup: () => {
    const { localStream, remoteStream, peerConnection } = get();
    localStream?.getTracks().forEach((t) => t.stop());
    remoteStream?.getTracks().forEach((t) => t.stop());
    peerConnection?.close();
    set({
      status: 'idle',
      callType: 'video',
      peer: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMicMuted: false,
      isCameraOff: false,
    });
  },
}));
