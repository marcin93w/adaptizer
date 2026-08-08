import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// react-range observes its track element to reposition thumbs, and jsdom has no
// ResizeObserver. Geometry is never asserted (see docs/testing-strategy.md), so a
// no-op is all react-range needs to mount.
class NoopResizeObserver {
    observe(): void { }
    unobserve(): void { }
    disconnect(): void { }
}
globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;

// A tree left mounted would keep firing effects - and debounce timers - during the
// next test. Testing Library auto-cleans under `globals: true`; this is belt and braces.
afterEach(() => {
    cleanup();
    localStorage.clear();
});
