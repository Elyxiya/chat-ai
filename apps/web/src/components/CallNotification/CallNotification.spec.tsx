import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockAcceptCall = vi.fn();
const mockRejectCall = vi.fn();
const mockSetStatus = vi.fn();
const mockSetCallType = vi.fn();
const mockSetPeer = vi.fn();
const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();

vi.mock('@/stores/call.store', () => ({
  useCallStore: Object.assign(
    (selector?: any) => {
      const state = {
        status: 'ringing',
        acceptCall: mockAcceptCall,
        rejectCall: mockRejectCall,
        _setStatus: mockSetStatus,
        _setCallType: mockSetCallType,
        setPeer: mockSetPeer,
      };
      return selector ? selector(state) : state;
    },
    { getState: () => ({
      _setStatus: mockSetStatus,
      _setCallType: mockSetCallType,
      setPeer: mockSetPeer,
    })},
  ),
}));

vi.mock('@/stores/chat.store', () => ({
  useChatStore: {
    getState: () => ({
      socket: {
        on: mockSocketOn,
        off: mockSocketOff,
      },
    }),
  },
}));

import CallNotification from './CallNotification';

describe('CallNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CALLNOTIF-WEB-01: should register socket listener on mount', () => {
    render(<CallNotification />);
    expect(mockSocketOn).toHaveBeenCalledWith('call:incoming', expect.any(Function));
  });

  it('CALLNOTIF-WEB-02: should show call incoming UI when socket emits', () => {
    render(<CallNotification />);
    const incomingHandler = mockSocketOn.mock.calls.find(
      (call: any) => call[0] === 'call:incoming'
    )?.[1];
    expect(incomingHandler).toBeDefined();

    act(() => {
      if (incomingHandler) {
        incomingHandler({
          callerId: 'user-2',
          callerName: 'Alice',
          callerAvatar: null,
          sdp: {},
          callType: 'video',
        });
      }
    });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/Video call · Incoming/)).toBeInTheDocument();
  });

  it('CALLNOTIF-WEB-03: should call setPeer with caller info', () => {
    render(<CallNotification />);
    const incomingHandler = mockSocketOn.mock.calls.find(
      (call: any) => call[0] === 'call:incoming'
    )?.[1];

    if (incomingHandler) {
      incomingHandler({
        callerId: 'user-2',
        callerName: 'Alice',
        callerAvatar: null,
        sdp: {},
        callType: 'audio',
      });
    }

    expect(mockSetPeer).toHaveBeenCalledWith({
      id: 'user-2',
      username: 'Alice',
      avatarUrl: null,
    });
  });

  it('CALLNOTIF-WEB-04: should show decline and accept buttons', () => {
    render(<CallNotification />);
    const incomingHandler = mockSocketOn.mock.calls.find(
      (call: any) => call[0] === 'call:incoming'
    )?.[1];

    act(() => {
      if (incomingHandler) {
        incomingHandler({
          callerId: 'user-2',
          callerName: 'Alice',
          callerAvatar: null,
          sdp: {},
          callType: 'video',
        });
      }
    });

    expect(screen.getByTitle('Decline')).toBeInTheDocument();
    expect(screen.getByTitle('Accept')).toBeInTheDocument();
  });

  it('CALLNOTIF-WEB-05: should render null when no incoming call', () => {
    const { container } = render(<CallNotification />);
    expect(container.innerHTML).toBe('');
  });
});
