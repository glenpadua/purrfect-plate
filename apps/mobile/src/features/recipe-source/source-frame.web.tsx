import { useEffect, useRef } from "react";
import type { Source } from "@purrfect-plate/recipe-core";

export function SourceFrame({ source, name }: { source: Source; name: string }) {
  return source.instagramUrl ? (
    <InstagramPost url={source.instagramUrl} />
  ) : (
    <iframe
      src={source.embedUrl}
      title={`${source.provider} source for ${name}`}
      style={{
        width: "100%",
        minHeight: 200,
        aspectRatio: source.portrait ? "9/16" : "16/9",
        border: 0,
      }}
      allow="encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
function InstagramPost({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const quote = document.createElement("blockquote");
    quote.className = "instagram-media";
    quote.dataset.instgrmPermalink = url;
    quote.dataset.instgrmVersion = "14";
    quote.style.cssText = "width:100%;min-width:0;margin:0";
    container.replaceChildren(quote);
    const process = () =>
      (
        window as Window & { instgrm?: { Embeds: { process: () => void } } }
      ).instgrm?.Embeds.process();
    let script = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.instagram.com/embed.js"]',
    );
    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
      document.body.append(script);
    }
    script.addEventListener("load", process);
    process();
    return () => {
      script?.removeEventListener("load", process);
      container.replaceChildren();
    };
  }, [url]);
  return (
    <div
      ref={host}
      role="region"
      aria-label="Instagram source"
      style={{ width: "100%", overflowX: "auto" }}
    />
  );
}
