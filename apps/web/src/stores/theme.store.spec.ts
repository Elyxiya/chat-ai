import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock matchMedia before any module imports using vi.hoisted
vi.hoisted(() => {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    writable: true,
  });
});

import { useThemeStore } from './theme.store';

describe('theme.store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeStore.setState({ theme: 'system', resolvedTheme: 'light' });
  });

  it('should have initial state with system theme', () => {
    const state = useThemeStore.getState();
    expect(state.theme).toBe('system');
    expect(state.resolvedTheme).toBe('light');
  });

  describe('setTheme', () => {
    it('should set light theme', () => {
      useThemeStore.getState().setTheme('light');
      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
      expect(state.resolvedTheme).toBe('light');
    });

    it('should set dark theme', () => {
      useThemeStore.getState().setTheme('dark');
      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
    });

    it('should set system theme and resolve to light by default', () => {
      useThemeStore.setState({ theme: 'light', resolvedTheme: 'light' });
      useThemeStore.getState().setTheme('system');
      const state = useThemeStore.getState();
      expect(state.theme).toBe('system');
      expect(state.resolvedTheme).toBe('light');
    });

    it('should add dark class to document when dark theme is set', () => {
      const classListAdd = vi.spyOn(document.documentElement.classList, 'add');

      useThemeStore.getState().setTheme('dark');

      expect(classListAdd).toHaveBeenCalledWith('dark');
    });

    it('should remove dark class when light theme is set', () => {
      document.documentElement.classList.add('dark');
      const classListRemove = vi.spyOn(document.documentElement.classList, 'remove');

      useThemeStore.getState().setTheme('light');

      expect(classListRemove).toHaveBeenCalledWith('dark');
    });
  });

  describe('persistence', () => {
    it('should persist theme preference to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      useThemeStore.getState().setTheme('dark');

      const persistCalls = setItemSpy.mock.calls.filter((c) => c[0] === 'theme-storage');
      expect(persistCalls.length).toBeGreaterThan(0);
    });
  });
});
