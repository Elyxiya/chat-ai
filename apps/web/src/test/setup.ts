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

// Mock requestAnimationFrame to fire synchronously (needed by batched socket message flush)
let rafId = 0;
window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  rafId++;
  cb(performance.now());
  return rafId;
}) as typeof window.requestAnimationFrame;
window.cancelAnimationFrame = vi.fn();

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

// Mock react-i18next — load full English translations so tests match rendered text
import enTranslations from '@/i18n/locales/en-US/translation.json';

/** Flatten nested translation object into dot-separated keys */
function flatten(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const k = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatten(value, k));
    } else {
      result[k] = String(value);
    }
  }
  return result;
}

const translationMap = flatten(enTranslations as Record<string, any>);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translationMap[key] || key.split('.').pop() || key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  Trans: ({ i18nKey }: { i18nKey: string }) => translationMap[i18nKey] || i18nKey,
}));

