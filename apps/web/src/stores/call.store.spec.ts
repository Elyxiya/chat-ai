import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCallStore } from './call.store';

const mockSocket = vi.hoisted(() => ({
  on: vi.fn().mockReturnThis(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
}));

vi.mock('@/stores/chat.store', () => ({
  useChatStore: {
    getState: () => ({ socket: mockSocket }),
  },
}));

// Mock navigator.mediaDevices.getUserMedia
const mockGetUserMedia = vi.fn();
vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
  },
});

describe('call.store - ICE Candidate Buffering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [
        { stop: vi.fn(), enabled: true },
        { stop: vi.fn(), enabled: true },
      ],
    });
    useCallStore.setState({
      status: 'idle',
      pendingIceCandidates: [],
      remoteDescriptionSet: false,
    });
  });

  describe('initial state', () => {
    it('CALL-ICE-01: should have empty pendingIceCandidates on init', () => {
      useCallStore.setState({
        pendingIceCandidates: [],
        remoteDescriptionSet: false,
      });
      expect(useCallStore.getState().pendingIceCandidates).toEqual([]);
    });

    it('CALL-ICE-02: should have remoteDescriptionSet false on init', () => {
      expect(useCallStore.getState().remoteDescriptionSet).toBe(false);
    });
  });

  describe('_addPendingCandidate', () => {
    it('CALL-ICE-03: should add candidate to pending array', () => {
      useCallStore.setState({ pendingIceCandidates: [] });
      const candidate: RTCIceCandidateInit = {
        candidate: 'candidate:1',
        sdpMid: '0',
        sdpMLineIndex: 0,
      };

      useCallStore.getState()._addPendingCandidate(candidate);

      expect(useCallStore.getState().pendingIceCandidates).toHaveLength(1);
      expect(useCallStore.getState().pendingIceCandidates[0]).toEqual(candidate);
    });

    it('CALL-ICE-04: should accumulate multiple pending candidates', () => {
      useCallStore.setState({ pendingIceCandidates: [] });
      const c1: RTCIceCandidateInit = { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 };
      const c2: RTCIceCandidateInit = { candidate: 'candidate:2', sdpMid: '1', sdpMLineIndex: 1 };

      useCallStore.getState()._addPendingCandidate(c1);
      useCallStore.getState()._addPendingCandidate(c2);

      expect(useCallStore.getState().pendingIceCandidates).toHaveLength(2);
    });
  });

  describe('_flushPendingCandidates', () => {
    it('CALL-ICE-05: should flush all pending candidates to PC', async () => {
      // Hoist mock fns so they are stable across all test runs
      const addFn = vi.fn().mockResolvedValue(undefined);
      const mockPC = { addIceCandidate: addFn } as unknown as RTCPeerConnection;

      useCallStore.setState({
        pendingIceCandidates: [
          { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 },
          { candidate: 'candidate:2', sdpMid: '1', sdpMLineIndex: 1 },
        ],
      });

      await useCallStore.getState()._flushPendingCandidates(mockPC);

      expect(addFn).toHaveBeenCalledTimes(2);
      expect(useCallStore.getState().pendingIceCandidates).toEqual([]);
    });

    it('CALL-ICE-06: should not add same candidate twice on multiple flush calls', async () => {
      const addFn = vi.fn().mockResolvedValue(undefined);
      const mockPC = { addIceCandidate: addFn } as unknown as RTCPeerConnection;

      useCallStore.setState({
        pendingIceCandidates: [
          { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 },
        ],
      });

      await useCallStore.getState()._flushPendingCandidates(mockPC);
      expect(addFn).toHaveBeenCalledTimes(1);

      // Second flush on empty queue — should be idempotent
      await useCallStore.getState()._flushPendingCandidates(mockPC);
      expect(addFn).toHaveBeenCalledTimes(1);
    });

    it('CALL-ICE-07: should handle empty pending queue gracefully', async () => {
      const mockPC = {
        addIceCandidate: vi.fn(),
      } as unknown as RTCPeerConnection;

      await useCallStore.getState()._flushPendingCandidates(mockPC);

      expect(mockPC.addIceCandidate).not.toHaveBeenCalled();
    });
  });

  describe('_setRemoteDescriptionSet', () => {
    it('CALL-ICE-08: should set remoteDescriptionSet flag to true', () => {
      const store = useCallStore.getState();
      expect(useCallStore.getState().remoteDescriptionSet).toBe(false);

      store._setRemoteDescriptionSet(true);

      expect(useCallStore.getState().remoteDescriptionSet).toBe(true);
    });

    it('CALL-ICE-09: should set remoteDescriptionSet flag to false', () => {
      useCallStore.setState({ remoteDescriptionSet: true });
      const store = useCallStore.getState();

      store._setRemoteDescriptionSet(false);

      expect(useCallStore.getState().remoteDescriptionSet).toBe(false);
    });
  });

  describe('_cleanup', () => {
    it('CALL-ICE-10: should reset pendingIceCandidates and remoteDescriptionSet', () => {
      // Setup: populate state with candidates and flag
      useCallStore.setState({
        pendingIceCandidates: [
          { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 },
        ],
        remoteDescriptionSet: true,
      });

      // Mock media streams and PC
      const mockLocalStream = {
        getTracks: () => [{ stop: vi.fn() }],
      };
      const mockRemoteStream = {
        getTracks: () => [{ stop: vi.fn() }],
      };
      const mockPC = { close: vi.fn() };

      useCallStore.setState({
        localStream: mockLocalStream as unknown as MediaStream,
        remoteStream: mockRemoteStream as unknown as MediaStream,
        peerConnection: mockPC as unknown as RTCPeerConnection,
      });

      useCallStore.getState()._cleanup();

      expect(useCallStore.getState().pendingIceCandidates).toEqual([]);
      expect(useCallStore.getState().remoteDescriptionSet).toBe(false);
    });
  });
});
