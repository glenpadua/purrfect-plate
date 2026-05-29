import "./globals.css"

import type { Metadata } from "next"
import { JetBrains_Mono, Outfit } from "next/font/google"

import ConvexClientProvider from "@/app/providers/convex-client-provider"
import { ModeToggle } from "@/components/mode-toggle"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Purrfect Plate",
    template: "%s | Purrfect Plate",
  },
  description: "A cozy cat-themed recipe picker for what-should-I-cook moments.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="fixed top-4 right-4 z-50">
            <ModeToggle />
          </div>
          <ConvexClientProvider>
            {children}
            <Toaster richColors position="bottom-right" />
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
