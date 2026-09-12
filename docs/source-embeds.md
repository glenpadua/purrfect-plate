# Inline recipe sources

`features/recipe-source/recipe-source.tsx` owns the source display. The detail screen passes only the saved source URL, creator attribution, and recipe name. This is separate from extraction: playing a source does not re-import it, call an AI provider, store video, or change recipe facts.

The source appears above ingredients and cook mode. Every supported provider has the same heading, attribution, tap-to-load action, and permanent **Open original** link. Hiding the source removes its player. Provider UI and branding remain intact; the surrounding app is consistent, but the controls inside these cross-origin players cannot be made identical.

Imported recipe detail pages use a compact text header without a cover image. Social thumbnails can be low-resolution or contain baked-in play buttons, so they are not enlarged into a hero. Manually uploaded recipe photos retain the existing photo header. This does not remove stored images or change library thumbnails.

Instagram keeps its 326px minimum post width. On unusually narrow screens (for example, a 320px viewport with page padding), its container can scroll horizontally and receive keyboard focus instead of cropping controls or widening the whole page. Normal iPhone widths fit the post without this adjustment. YouTube and TikTok fill the available width; no provider height is cropped.

## Supported sources

| Source | Rendering | Layout |
| --- | --- | --- |
| YouTube watch, Shorts, youtu.be, embed/live URLs | Official privacy-enhanced iframe | Shorts use a centered portrait frame; other links use 16:9 with a 200px minimum height |
| TikTok canonical `@creator/video/ID` | Official `/player/v1/ID` iframe | Centered portrait frame |
| Instagram post, reel, and legacy TV URL | Instagram blockquote and `embed.js` | Provider-sized post, centered with a 360px maximum width |
| Websites or unsupported social links | Original source link | Compact attribution strip |

URLs are parsed locally. Only exact supported hosts and validated IDs generate an embed URL; custom ports, credentials, unsafe schemes, malformed IDs, and lookalike domains cannot become players. No imported HTML is injected. Website content is never framed. The original saved URL remains unchanged for attribution. TikTok shortened share URLs need to have been resolved to a canonical video URL during import; the renderer does not fetch redirects.

## Loading and limitations

No player or Instagram script is mounted before the user taps. YouTube uses `youtube-nocookie.com`, `playsinline=1`, and `autoplay=0`; TikTok also explicitly disables autoplay. Loading still contacts the provider. Hiding Instagram removes its rendered post but does not unload the already-downloaded SDK.

YouTube documents its iframe URL, mobile inline playback, minimum size, and supported controls in [Player parameters](https://developers.google.com/youtube/player_parameters). [Privacy-enhanced embedding](https://support.google.com/youtube/answer/171780?hl=en) changes how viewing affects personalization; it does not make playback an offline or first-party operation. Related content and branding cannot be completely removed.

TikTok documents [the iframe player, controls, and error messages](https://developers.tiktok.com/docs/en/embed-player). Reported player errors are accepted only from the mounted iframe and TikTok's exact origin. We keep normal playback/fullscreen controls.

Instagram uses its public-post renderer rather than relying on an undocumented fixed-height iframe URL. References: [Instagram embedding help](https://help.instagram.com/620154495870484) and [Meta oEmbed documentation](https://developers.facebook.com/docs/instagram-platform/oembed/). These Meta documentation pages returned HTTP 429 during the September 12, 2026 research pass, so their current full text could not be rechecked. The SDK is loaded once through Next.js `Script`, processes newly mounted posts, and owns only a dedicated DOM container. We do not call Meta's token-protected oEmbed API.

Private, deleted, age/region-restricted, embedding-disabled, login-gated, or browser-blocked sources can fail. An iframe `load` event only means its document loaded; it is not proof that the video can play. A slow-load message and the permanent external link keep the recipe usable. Instagram may show a post or carousel instead of a video. Orientation is inferred only from an explicit YouTube Shorts route; a short shared as a watch link can be letterboxed.

This is the responsive web implementation. The future Expo app needs a reviewed WebView/native source strategy; this component is not a React Native player.

## Verification

Three component-interface tests cover tap-to-load/hide, preserved attribution, safe provider URL construction, malformed/lookalike URL fallback, and Instagram's deferred markup. They do not simulate third-party playback. Physical iPhone playback and each provider's real hosted player remain acceptance checks, especially when cookies or tracking protection are restricted.
