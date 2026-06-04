import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockChannels = [
  { id: 'ch-1', name: 'Announcements', description: 'Official announcements', _count: { members: 15 }, myRole: 'owner' },
  { id: 'ch-2', name: 'Random', description: 'Random chat', _count: { members: 42 }, myRole: 'member' },
];

const { mockGetChannels, mockCreateChannel, mockSubscribeChannel, mockUnsubscribeChannel } = vi.hoisted(() => ({
  mockGetChannels: vi.fn(),
  mockCreateChannel: vi.fn(),
  mockSubscribeChannel: vi.fn(),
  mockUnsubscribeChannel: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  chatApi: {
    getChannels: mockGetChannels,
    createChannel: mockCreateChannel,
    subscribeChannel: mockSubscribeChannel,
    unsubscribeChannel: mockUnsubscribeChannel,
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({}) };
});

vi.mock('@/stores/chat.store', () => ({
  useChatStore: (selector?: any) => {
    const state = {};
    return selector ? selector(state) : state;
  },
}));

import ChannelList from './ChannelList';

describe('ChannelList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChannels.mockResolvedValue({ data: mockChannels });
  });

  it('CHANNEL-WEB-01: should render with title', async () => {
    render(<ChannelList />);
    expect(screen.getByText('Channels')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetChannels).toHaveBeenCalled();
    });
  });

  it('CHANNEL-WEB-02: should display channel list', async () => {
    render(<ChannelList />);
    await waitFor(() => {
      expect(screen.getByText('Announcements')).toBeInTheDocument();
      expect(screen.getByText('Random')).toBeInTheDocument();
    });
  });

  it('CHANNEL-WEB-03: should show subscriber count', async () => {
    render(<ChannelList />);
    await waitFor(() => {
      expect(screen.getByText('15 subscribers')).toBeInTheDocument();
      expect(screen.getByText('42 subscribers')).toBeInTheDocument();
    });
  });

  it('CHANNEL-WEB-04: should show Owner badge for owned channels', async () => {
    render(<ChannelList />);
    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });
  });

  it('CHANNEL-WEB-05: should show create form when + clicked', () => {
    render(<ChannelList />);
    fireEvent.click(screen.getByTitle('Create channel'));
    expect(screen.getByPlaceholderText('Channel name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('CHANNEL-WEB-06: should navigate on channel click', async () => {
    render(<ChannelList />);
    await waitFor(() => {
      expect(screen.getByText('Announcements')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Announcements'));
    expect(mockNavigate).toHaveBeenCalledWith('/channel/ch-1');
  });

  it('CHANNEL-WEB-07: should show empty state', async () => {
    mockGetChannels.mockResolvedValue({ data: [] });
    render(<ChannelList />);
    await waitFor(() => {
      expect(screen.getByText('No channels yet')).toBeInTheDocument();
    });
  });

  it('CHANNEL-WEB-08: should show loading state', () => {
    mockGetChannels.mockImplementation(() => new Promise(() => {}));
    render(<ChannelList />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
