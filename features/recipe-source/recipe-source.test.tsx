import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"
import { RecipeSource } from "./recipe-source"

afterEach(cleanup)

test("loads a YouTube source only on request and keeps its original attribution", () => {
  render(<RecipeSource sourceUrl="https://youtube.com/shorts/z1XshOQJmrw?si=tracking" sourceAuthor="Recipe creator" recipeName="Crunchwrap" />)
  expect(screen.queryByTitle("YouTube source for Crunchwrap")).not.toBeInTheDocument()
  expect(screen.getByText(/Recipe creator/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Load YouTube video" }))
  const frame = screen.getByTitle("YouTube source for Crunchwrap")
  expect(frame).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/z1XshOQJmrw?autoplay=0&playsinline=1&rel=0")
  expect(screen.getByRole("link", { name: "Open original" })).toHaveAttribute("href", "https://youtube.com/shorts/z1XshOQJmrw?si=tracking")
  fireEvent.click(screen.getByRole("button", { name: "Hide source" }))
  expect(screen.queryByTitle("YouTube source for Crunchwrap")).not.toBeInTheDocument()
})

test("requests Instagram's post renderer only after tapping and removes it when hidden", () => {
  const { container } = render(<RecipeSource sourceUrl="https://www.instagram.com/reel/DdJyDKhKk1i/?utm_source=copy" recipeName="Dinner" />)
  expect(container.querySelector("blockquote")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Load Instagram post" }))
  expect(container.querySelector("blockquote")).toHaveAttribute("data-instgrm-permalink", "https://www.instagram.com/p/DdJyDKhKk1i/")
  fireEvent.click(screen.getByRole("button", { name: "Hide source" }))
  expect(container.querySelector("blockquote")).toBeNull()
})

test("offers TikTok inline playback and keeps unsupported or unsafe URLs out of players", () => {
  const { rerender } = render(<RecipeSource sourceUrl="https://www.tiktok.com/@biteswithesther/video/7351594254663159083" recipeName="Pasta" />)
  fireEvent.click(screen.getByRole("button", { name: "Load TikTok video" }))
  expect(screen.getByTitle("TikTok source for Pasta")).toHaveAttribute("src", "https://www.tiktok.com/player/v1/7351594254663159083?autoplay=0&controls=1&rel=0")
  for (const sourceUrl of ["https://youtube.com.evil.example/watch?v=z1XshOQJmrw", "https://youtube.com/watch?v=invalid", "https://recipes.example/dinner", "https://www.tiktok.com/@creator", "https://youtube.com:444/watch?v=z1XshOQJmrw"]) {
    rerender(<RecipeSource sourceUrl={sourceUrl} recipeName="Pasta" />)
    expect(screen.queryByRole("button", { name: /Load/ })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open original" })).toBeInTheDocument()
  }
  rerender(<RecipeSource sourceUrl="javascript:alert(1)" recipeName="Pasta" />)
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
})
