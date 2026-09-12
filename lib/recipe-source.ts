export type Source = {
  url: string;
  provider: string;
  embedUrl?: string;
  instagramUrl?: string;
  portrait?: boolean;
};

export function describeSource(value: string): Source | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  if ((host === "youtube.com" || host === "youtu.be") && !url.port) {
    const match = url.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})\/?$/);
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1).replace(/\/$/, "")
        : url.pathname === "/watch"
          ? url.searchParams.get("v")
          : match?.[2];
    if (id && /^[\w-]{11}$/.test(id))
      return {
        url: url.href,
        provider: "YouTube",
        portrait: match?.[1] === "shorts",
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&playsinline=1&rel=0`,
      };
  }
  const tiktokId =
    host === "tiktok.com" &&
    !url.port &&
    url.pathname.match(/^\/@[^/]+\/video\/(\d{15,25})\/?$/)?.[1];
  if (tiktokId)
    return {
      url: url.href,
      provider: "TikTok",
      portrait: true,
      embedUrl: `https://www.tiktok.com/player/v1/${tiktokId}?autoplay=0&controls=1&rel=0`,
    };
  const instagramId =
    host === "instagram.com" &&
    !url.port &&
    url.pathname.match(/^\/(?:p|reel|tv)\/([\w-]{5,32})\/?$/)?.[1];
  if (instagramId)
    return {
      url: url.href,
      provider: "Instagram",
      instagramUrl: `https://www.instagram.com/p/${instagramId}/`,
    };
  return { url: url.href, provider: url.hostname.replace(/^www\./, "") };
}
