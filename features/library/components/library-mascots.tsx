"use client"

import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Cat } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export const bottomPeekCatSrc = "/animations/cat-peek-bottom.lottie"
const peekEdges = ["bottom", "left", "right", "top"] as const
const sidePeekEdges = ["left", "right"] as const

type PeekEdge = (typeof peekEdges)[number]

function assetPath(basePath: string, assetUrl: string, assetName: string) {
  if (/^https?:\/\//.test(assetName) || assetName.startsWith("/")) {
    return assetName
  }

  if (assetUrl.startsWith("/")) {
    return `${assetUrl}${assetName}`
  }

  const baseDirectory = basePath.slice(0, basePath.lastIndexOf("/") + 1)
  return `${baseDirectory}${assetUrl}${assetName}`
}

export function ModalMascot({ src }: { src: string }) {
  const [isAnimationReady, setIsAnimationReady] = useState(false)
  const [hasAnimationError, setHasAnimationError] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    let isMounted = true

    setIsAnimationReady(false)
    setHasAnimationError(false)

    if (!src.endsWith(".json")) {
      setIsAnimationReady(true)
      return () => {
        isMounted = false
      }
    }

    fetch(src)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Animation not found")
        }

        const data = (await response.json()) as {
          assets?: Array<{ e?: number; p?: string; u?: string }>
        }
        const externalAssets =
          data.assets?.filter((asset) => asset.e !== 1 && asset.p) ?? []

        if (!externalAssets.length) {
          return true
        }

        const checks = await Promise.all(
          externalAssets.map(async (asset) => {
            const response = await fetch(
              assetPath(src, asset.u ?? "", asset.p ?? ""),
              { method: "HEAD" },
            )
            return response.ok
          }),
        )

        return checks.every(Boolean)
      })
      .then((isReady) => {
        if (isMounted) {
          setIsAnimationReady(isReady)
        }
      })
      .catch(() => {
        if (isMounted) {
          setHasAnimationError(true)
        }
      })

    return () => {
      isMounted = false
    }
  }, [src])

  if (shouldReduceMotion || !isAnimationReady || hasAnimationError) {
    return (
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion ? undefined : { rotate: [-2, 2, -2], y: [0, -3, 0] }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="grid size-24 place-items-center rounded-full border border-primary/20 bg-background/75 text-primary shadow-lg shadow-primary/10 backdrop-blur dark:bg-card/80"
      >
        <Cat className="size-14" />
      </motion.div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="grid size-28 place-items-center rounded-full border border-primary/20 bg-background/75 p-2 shadow-lg shadow-primary/10 backdrop-blur dark:bg-card/80 sm:size-32"
    >
      <DotLottieReact
        src={src}
        autoplay
        loop
        className="size-full"
        dotLottieRefCallback={(dotLottie) => {
          if (!dotLottie) {
            return
          }

          dotLottie.addEventListener("loadError", () => {
            setHasAnimationError(true)
          })
        }}
      />
    </div>
  )
}

function peekPlacement(edge: PeekEdge) {
  if (edge === "top") {
    return {
      className: "left-1/2 top-0 w-36 -translate-x-1/2 sm:w-44",
      rotation: 180,
      initial: { opacity: 0, y: "-72%" },
      animate: { opacity: 1, y: "-2%" },
      exit: { opacity: 0, y: "-78%" },
    }
  }

  if (edge === "left") {
    return {
      className: "left-0 top-[42%] w-36 -translate-y-1/2 sm:w-44",
      rotation: 90,
      initial: { opacity: 0, x: "-78%" },
      animate: { opacity: 1, x: "-20%" },
      exit: { opacity: 0, x: "-84%" },
    }
  }

  if (edge === "right") {
    return {
      className: "right-0 top-[42%] w-36 -translate-y-1/2 sm:w-44",
      rotation: -90,
      initial: { opacity: 0, x: "78%" },
      animate: { opacity: 1, x: "20%" },
      exit: { opacity: 0, x: "84%" },
    }
  }

  return {
    className: "bottom-0 left-1/2 w-36 -translate-x-1/2 sm:w-44",
    rotation: 0,
    initial: { opacity: 0, y: "72%" },
    animate: { opacity: 1, y: "2%" },
    exit: { opacity: 0, y: "78%" },
  }
}

function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function scrollAwarePeekEdge(): PeekEdge {
  const scrollY = window.scrollY
  const viewportHeight = window.innerHeight
  const documentHeight = document.documentElement.scrollHeight
  const isAtTop = scrollY <= 8
  const isAtBottom = scrollY + viewportHeight >= documentHeight - 8
  const availableEdges: PeekEdge[] = [...sidePeekEdges]

  if (isAtTop) {
    availableEdges.push("top")
  }

  if (isAtBottom) {
    availableEdges.push("bottom")
  }

  return randomItem(availableEdges)
}

export function PeekCat({ active, src }: { active: boolean; src: string }) {
  const [isAssetAvailable, setIsAssetAvailable] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [edge, setEdge] = useState<PeekEdge>("bottom")
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    let isMounted = true

    fetch(src, { method: "HEAD" })
      .then((response) => {
        if (isMounted) {
          setIsAssetAvailable(response.ok)
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsAssetAvailable(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [src])

  useEffect(() => {
    if (!active || !isAssetAvailable || shouldReduceMotion) {
      setIsVisible(false)
      return
    }

    let showTimer: number
    let hideTimer: number

    function schedulePeek() {
      const delay = 4500 + Math.random() * 7500

      showTimer = window.setTimeout(() => {
        setEdge(scrollAwarePeekEdge())
        setIsVisible(true)
        hideTimer = window.setTimeout(() => {
          setIsVisible(false)
          schedulePeek()
        }, 4200)
      }, delay)
    }

    schedulePeek()

    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [active, isAssetAvailable, shouldReduceMotion])

  const placement = peekPlacement(edge)

  return (
    <AnimatePresence>
      {active && isVisible ? (
        <motion.div
          aria-hidden="true"
          className={cn("pointer-events-none fixed z-30", placement.className)}
          initial={placement.initial}
          animate={placement.animate}
          exit={placement.exit}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ rotate: `${placement.rotation}deg` }}>
            <DotLottieReact
              src={src}
              autoplay
              loop
              className="h-auto w-full"
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
