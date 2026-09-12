"use client"

import { ExternalLink, Play, X } from "lucide-react"
import Script from "next/script"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

import { describeSource, type Source } from "@/lib/recipe-source"

export function RecipeSource({ sourceUrl, sourceAuthor, recipeName }: {
  sourceUrl: string; sourceAuthor?: string; recipeName: string
}) {
  const source = describeSource(sourceUrl)
  if (!source) return null
  return <SourceCard key={source.url} source={source} sourceAuthor={sourceAuthor} recipeName={recipeName} />
}

function SourceCard({ source, sourceAuthor, recipeName }: { source: Source; sourceAuthor?: string; recipeName: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section aria-label="Recipe source" className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Original source</h2>
          <p className="break-words text-sm text-muted-foreground">{source.provider}{sourceAuthor ? ` · ${sourceAuthor}` : ""}</p>
        </div>
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary underline underline-offset-4">
          Open original <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </div>
      {source.embedUrl || source.instagramUrl ? (
        <div className="border-t">
          {expanded ? <>
            {source.instagramUrl
              ? <InstagramPost url={source.instagramUrl} recipeName={recipeName} />
              : <VideoPlayer source={source} recipeName={recipeName} />}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <p className="max-w-sm text-xs text-muted-foreground">Can’t play it here? Open the original above.</p>
              <Button type="button" variant="ghost" onClick={() => setExpanded(false)}><X aria-hidden="true" className="size-4" />Hide source</Button>
            </div>
          </> : <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setExpanded(true)}><Play aria-hidden="true" className="size-4" />Load {source.provider} {source.instagramUrl ? "post" : "video"}</Button>
            <p className="max-w-xs text-xs leading-5 text-muted-foreground">Loads content from {source.provider} when you tap. Nothing plays automatically.</p>
          </div>}
        </div>
      ) : null}
    </section>
  )
}

function VideoPlayer({ source, recipeName }: { source: Source; recipeName: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState("Loading source…")
  useEffect(() => {
    const timer = window.setTimeout(() => setStatus((current) => current ? "Taking longer than usual. You can open the original above." : ""), 15000)
    function onMessage(event: MessageEvent) {
      if (source.provider !== "TikTok" || event.origin !== "https://www.tiktok.com" || event.source !== frame.current?.contentWindow) return
      if (event.data?.["x-tiktok-player"] === true && event.data.type === "onPlayerError") setStatus("This source can’t play here. Open the original above.")
    }
    window.addEventListener("message", onMessage)
    return () => { window.clearTimeout(timer); window.removeEventListener("message", onMessage) }
  }, [source.provider])
  return <>
    {status ? <p role="status" className="px-4 py-2 text-xs text-muted-foreground">{status}</p> : null}
    <div className={`mx-auto w-full ${source.portrait ? "aspect-[9/16] max-w-[360px]" : "aspect-video min-h-[200px]"}`}>
      <iframe ref={frame} src={source.embedUrl} title={`${source.provider} source for ${recipeName}`} className="size-full border-0" allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setStatus("")} onError={() => setStatus("This source can’t load here. Open the original above.")} />
    </div>
  </>
}

function InstagramPost({ url, recipeName }: { url: string; recipeName: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState("Loading source…")
  useEffect(() => {
    const container = host.current
    if (!container) return
    // Instagram replaces its blockquote. Keep that DOM outside React's child tree.
    const quote = document.createElement("blockquote")
    quote.className = "instagram-media"
    quote.dataset.instgrmPermalink = url
    quote.dataset.instgrmVersion = "14"
    quote.style.cssText = "width:100%;min-width:326px;margin:0"
    container.replaceChildren(quote)
    const observer = new MutationObserver(() => {
      const iframe = container.querySelector("iframe")
      if (iframe) {
        iframe.title = `Instagram source for ${recipeName}`
        setStatus("")
        observer.disconnect()
      }
    })
    observer.observe(container, { childList: true, subtree: true })
    processInstagram()
    const timer = window.setTimeout(() => setStatus((current) => current ? "Instagram hasn’t loaded. You can open the original above." : ""), 15000)
    return () => { observer.disconnect(); window.clearTimeout(timer); container.replaceChildren() }
  }, [url, recipeName])
  return <>
    {status ? <p role="status" className="px-4 py-2 text-xs text-muted-foreground">{status}</p> : null}
    <div ref={host} role="region" aria-label="Instagram post" tabIndex={0} className="mx-auto w-full max-w-[360px] overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary [&_iframe]:!m-0 [&_iframe]:!min-w-[326px] [&_iframe]:!w-full" />
    <Script src="https://www.instagram.com/embed.js" strategy="afterInteractive" onReady={processInstagram} onError={() => setStatus("Instagram can’t load here. Open the original above.")} />
  </>
}

function processInstagram() {
  const instagram = (window as Window & { instgrm?: { Embeds: { process: () => void } } }).instgrm
  instagram?.Embeds.process()
}
