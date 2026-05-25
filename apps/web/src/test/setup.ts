import '@testing-library/jest-dom/vitest';

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn() as any;

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
