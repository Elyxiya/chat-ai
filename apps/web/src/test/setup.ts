import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn() as any;

// Mock elementFromPoint for jsdom (needed by prosemirror-view / Tiptap)
document.elementFromPoint = vi.fn(() => document.createElement('div')) as any;

// Mock IntersectionObserver for jsdom — fires callback synchronously so inView is set immediately
const mockIntersectionCallbacks: Set<IntersectionObserverCallback> = new Set();
class MockIntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(callback?: IntersectionObserverCallback) {
    if (callback) mockIntersectionCallbacks.add(callback);
  }
  observe(target: Element) {
    // Fire callback synchronously so LazyImage sets inView immediately
    mockIntersectionCallbacks.forEach((cb) => cb([{ isIntersecting: true, target } as any], this as any));
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver for jsdom
class MockResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

// Auto-use __mocks__/RichTextEditor.tsx (replaces Tiptap with textarea in tests)
vi.mock('@/components/RichTextEditor/RichTextEditor');

// Mock react-i18next with English translations matching component & test expectations
const translationMap: Record<string, string> = {
  'auth.noAccount': "Don't have an account? Sign up",
  'auth.haveAccount': 'Already have an account? Sign in',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.languageZh': '中文',
  'settings.languageEn': 'English',
  'settings.defaultAgentMode': 'Default Mode',
  'profile.profileInfo': 'Profile',
  'profile.nickname': 'Nickname',
  'profile.nicknamePlaceholder': 'Enter your nickname',
  'profile.bio': 'Bio',
  'profile.bioPlaceholder': 'Tell us about yourself',
  'common.saving': 'Saving...',
  'common.save': 'Save Changes',
  'agent.title': 'AI Agent Settings',
  'auth.logout': 'Sign Out',
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translationMap[key] || key.split('.').pop() || key,
    i18n: { language: 'zh', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  Trans: ({ i18nKey }: { i18nKey: string }) => translationMap[i18nKey] || i18nKey,
}));

