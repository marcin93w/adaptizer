import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not currently provide PointerEvent. The editor only relies on the mouse
// coordinates and pointerId additions, so MouseEvent is the correct test substitute.
globalThis.PointerEvent ??= MouseEvent as unknown as typeof PointerEvent;

// A tree left mounted would keep firing effects - and debounce timers - during the
// next test. Testing Library auto-cleans under `globals: true`; this is belt and braces.
afterEach(() => {
    cleanup();
    localStorage.clear();
});
