import { create } from 'zustand';
import { apiClient } from '@/api/client';

export interface Friend {
  id: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  status?: string;
}

interface FriendState {
  friends: Friend[];
  isLoading: boolean;
  error: string | null;
  fetchFriends: () => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
}

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  isLoading: false,
  error: null,

  fetchFriends: async () => {
    set({ isLoading: true, error: null });
    try {
      const result: any = await apiClient.get('/chat/friends');
      const loaded: Friend[] = result?.data || [];
      set({ friends: loaded, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: (err as Error)?.message || 'Failed to fetch friends',
      });
      // Do NOT clear friends on error — preserve existing data for offline resilience
    }
  },

  removeFriend: async (friendId) => {
    try {
      await apiClient.delete(`/chat/friends/${friendId}`);
      set((state) => ({
        friends: state.friends.filter((f) => f.id !== friendId),
      }));
    } catch (err) {
      // Let the caller handle the error (toast, etc.)
      throw err;
    }
  },
}));
