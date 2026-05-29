import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

afterEach(() => {
  if (typeof document !== "undefined") {
    cleanup()
  }
})

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }

  if (!window.PointerEvent && typeof MouseEvent !== "undefined") {
    class PointerEvent extends MouseEvent {}

    window.PointerEvent = PointerEvent as typeof window.PointerEvent
  }
}

if (typeof globalThis !== "undefined" && !("ResizeObserver" in globalThis)) {
  class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  }

  globalThis.ResizeObserver = ResizeObserver
}

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}
