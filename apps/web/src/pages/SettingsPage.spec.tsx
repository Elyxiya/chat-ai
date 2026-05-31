import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  nickname: 'Test',
  bio: 'Bio text',
  avatarUrl: null,
  userType: 'human' as const,
  status: 'online' as const,
  createdAt: '2025-01-01T00:00:00Z',
};

const mockUpdateUser = vi.fn();
const mockLogout = vi.fn();

const { mockUseAuthStore } = vi.hoisted(() => {
  const mockFn: any = (selector?: any) => {
    const state = { user: mockUser, logout: mockLogout, updateUser: mockUpdateUser };
    return selector ? selector(state) : state;
  };
  mockFn.getState = () => ({ user: mockUser });
  return { mockUseAuthStore: mockFn };
});

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock('@/api/client', () => ({
  userApi: {
    updateProfile: vi.fn().mockResolvedValue({}),
    uploadAvatar: vi.fn(),
  },
}));

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render user profile information', () => {
    render(<SettingsPage />);
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should display nickname and bio from user state', () => {
    render(<SettingsPage />);
    expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bio text')).toBeInTheDocument();
  });

  it('should call updateUser when saving profile', async () => {
    const { userApi } = await import('@/api/client');
    vi.mocked(userApi.updateProfile).mockResolvedValue({});

    render(<SettingsPage />);
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(userApi.updateProfile).toHaveBeenCalled();
      expect(mockUpdateUser).toHaveBeenCalled();
    });
  });

  it('should show success message after saving', async () => {
    const { userApi } = await import('@/api/client');
    vi.mocked(userApi.updateProfile).mockResolvedValue({});

    render(<SettingsPage />);
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    });
  });

  it('should show AI Agent settings section', () => {
    render(<SettingsPage />);
    expect(screen.getByText('AI Agent Settings')).toBeInTheDocument();
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
  });

  it('should show Account section with Sign Out button', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('should call logout when Sign Out is clicked', () => {
    render(<SettingsPage />);
    const signOutButton = screen.getByText('Sign Out');
    fireEvent.click(signOutButton);
    expect(mockLogout).toHaveBeenCalled();
  });

  it('should have AI mode selector', () => {
    render(<SettingsPage />);
    const select = document.querySelector('select');
    expect(select).toBeInTheDocument();
    expect(select?.children.length).toBe(3);
    expect(select?.children[0]).toHaveValue('react');
    expect(select?.children[1]).toHaveValue('planner');
    expect(select?.children[2]).toHaveValue('reasoner');
  });
});
