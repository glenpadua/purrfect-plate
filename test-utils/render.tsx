import type { ReactElement, ReactNode } from "react"
import { render as rtlRender, type RenderOptions } from "@testing-library/react"

function TestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: TestWrapper, ...options })
}

export * from "@testing-library/react"
export { render }
