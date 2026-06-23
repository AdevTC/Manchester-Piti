import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// @testing-library/react auto-cleans when `globals: true`, but registering it
// explicitly keeps the per-test teardown unambiguous (unmounts the tree, so the
// jsdom document starts each test empty — no leaked nodes / cross-test bleed).
afterEach(() => {
  cleanup();
});

// jsdom lacks a handful of DOM APIs that Radix UI primitives (the shadcn Select
// in Admin) touch on mount. Polyfill them so rendering those components in tests
// doesn't throw. These are no-ops sufficient for assertion-level tests; we don't
// drive the Radix dropdown open in jsdom (that path is covered by e2e later).
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
// Admin's notify* helpers call window.scrollTo; jsdom doesn't implement it.
if (typeof window !== "undefined") {
  window.scrollTo = vi.fn();
}
