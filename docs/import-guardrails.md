# Level-one recipe import guardrails

Research and implementation guidance, checked 12 September 2026. The level-one
implementation is described below; the acceptance matrix also includes future
coverage and must not be read as a list of completed live tests.
See `lib/recipe-import/service.ts`, `extraction/http.ts`, `extraction/parse.ts`,
`normalize.ts`, and `convex/imports.ts` for the executable behavior.

The first version should cheaply reject clearly wrong targets, preserve incomplete
recipes honestly, and stop expensive processing when nothing useful remains. It
cannot guarantee that an AI classification or transcription is correct. Treat
“probably cooking,” “standalone technique,” “partial dish recipe,” and “complete
recipe” as different judgments. A wrapping tutorial is not a burrito recipe just
because a tortilla and generic fillings appear in it.

## What the current pipeline already does

- Authenticated imports are deduplicated by library and source key; daily and
  concurrent import quotas are enforced before scheduling.
- Public fetches require HTTPS, reject credentials/custom ports/private addresses,
  check DNS answers, pin the connection, and revalidate redirects. Keep these
  checks regardless of content classification.
- Pages are parsed for Recipe JSON-LD, matching publisher notes, descriptions, and
  public text. Complete structured recipes use a deterministic normalization path.
- Wrong social link shapes and unsupported files reject before creating a job or consuming import quota. Resolved targets are checked again; a social login redirect retains the original post for the media fallback.
- Available metadata and native captions are read before expensive media work. Complete structured recipes and explicitly headed complete captions bypass the relevance model; complete captions also skip media analysis.
- Remaining text is screened with GPT-4.1-mini: at most 8,000 input characters, 350 output tokens and a 12-second timeout. Inputs shorter than 12 characters remain unknown. `technique` means an explicitly standalone skill, such as wrapping any burrito, sharpening a knife or a chopping tutorial; it rejects with `not_recipe`. An exact supporting quote is required (12 characters for technique, 20 for unrelated content). Truncated inputs, missing metadata, unsupported quotes and classifier failures remain unknown. Rejected decisions retain reason, quote and usage for audit.
- Metadata classification is probabilistic and does not prove what an unseen video contains. The UI says the source does not look like a recipe, gives a specific technique/unrelated explanation, and lets the signed-in user explicitly extract anyway. This overrides both early and final relevance classification only, never URL safety, quota, duration, source-fact requirements or the empty-evidence stop.
- Unknown specific posts receive bounded media inspection. A 260-second processing budget reserves normalization time; source-fetch deadlines cover DNS and redirects together. Image/frame analysis stops when its budget runs out and reports incomplete photo coverage. The outer route still has a 300-second ceiling.
- The existing normalization model also returns `contentType` and a `classificationQuote`, adding no extra provider call. A source-backed final `technique` or `unrelated` decision rejects even if generic ingredients/steps could be extracted; its bounded audit retains media and normalization usage. Unsupported negative quotes become unknown. An explicit relevance override permits source-backed output with a warning. Real recipes containing wrapping/chopping and partial recipes without exact amounts remain eligible.
- General visual observations never become recipe facts. Empty eligible evidence stops before normalization; covers are fetched only after a nonempty draft. Partial facts retain missing-information warnings. Retrieval/provider failures remain distinct where the adapter reports them.
- Failure UI distinguishes non-recipe (including standalone techniques), unavailable and insufficient sources. Incomplete drafts/failures offer an opt-in external recipe search with an editable query. The user chooses a source and pastes its link back; the app does not automatically fetch or invent alternative recipe cards.

## Priority 1: deterministic target checks before paid processing

The implementation uses the pure `checkImportTarget(url)` boundary in the server import entry
and again after redirect resolution. It rejects known wrong shapes with a typed reason and permits supported redirect links for bounded resolution. Reuse the existing
source-key logic; do not invent a second canonicalization scheme.

| Target | First-version decision |
| --- | --- |
| YouTube `watch?v=<id>`, `youtu.be/<id>`, `shorts/<id>`, supported `embed/<id>` | Specific video; validate the ID shape, not its existence. Keep a `watch` link with both `v` and `list`: its video ID still identifies one video. |
| YouTube home, channel, handle, search, playlist without a video ID | Ask for the particular video link; no model call or playlist crawl. |
| Instagram `/p/<code>/`, `/reel/<code>/`, existing supported legacy post forms | Specific post. Carousel position and tracking parameters should not create a second import. |
| Instagram home, profile, explore, login | Ask for the post/reel link. A login redirect from a valid post means unavailable access, not an unrelated source. |
| TikTok `/@name/video/<id>` | Specific post. |
| TikTok short/share URLs | Resolve through bounded public redirects, then classify. Do not reject merely because the input lacks `/video/`. |
| TikTok profile, home, search, tag, sound collection | Ask for the individual post. |
| General website URL | Fetch bounded public HTML before deciding. A homepage can contain a real recipe, and a recipe need not have `recipe` in its URL. |
| Direct unsupported media/document file | Say which input is supported and request a recipe page/post. Do not send arbitrary binary content to the text normalizer. |

These are product scope rules, not a claim that URL syntax proves content. YouTube
distinguishes videos from playlists and user-upload collections in its official
[player documentation](https://developers.google.com/youtube/player_parameters).
TikTok's official [embed documentation](https://developers.tiktok.com/docs/en/embed-videos)
uses individual `/@user/video/<id>` URLs. Instagram route handling above follows
the existing project samples and source canonicalization; it is not a promise
that every share-link variant or private post is retrievable.

Run deterministic rejection before incrementing the expensive-import quota.
Separate lightweight invalid-input throttling from model-call budgets so this does
not remove abuse protection. Preserve existing deduplication before paid calls.

## Priority 2: assess evidence, then escalate only when needed

Add a pure `assessRecipeEvidence(evidence, coverage)` boundary. Return a decision
and reason rather than a single confidence number. `coverage` must say what was
actually read: full/truncated caption, available transcript, OCR samples, blocked
page, and any video clipping. A model's self-reported confidence is not a
calibrated probability.

1. **Strong positive:** a specific structured Recipe with ingredients and steps,
   or explicit recipe text, can proceed directly to draft creation. Reuse those
   facts without a mandatory second classifier. Recipe markup is a useful signal;
   validate its contents and retain source attribution. Google's
   [Recipe documentation](https://developers.google.com/search/docs/appearance/structured-data/recipe)
   distinguishes individual recipes, ingredient text, preparation steps, and
   recipe collection pages. A Schema.org label alone does not prove completeness.
2. **Clear nonrecipe page:** readable main content that is positively identified
   as an unrelated article, catalogue, or collection can stop before multimodal
   work. Use deterministic collection/target rules where possible. An optional
   bounded text classifier may help ambiguous readable pages, but should return
   `recipe`, `not_recipe`, or `unknown`, with evidence IDs and a short reason.
   Validate those references. Do not interpret missing cooking keywords as
   `not_recipe`, especially for another language, a terse caption, or an unreadable
   page. A low-cost classifier still costs money and can make mistakes.
3. **Unknown specific social post:** read available caption/transcript, then use
   the existing bounded multimodal fallback if evidence remains weak. A title,
   hashtags, thumbnail, or song lyrics alone usually cannot establish the unseen
   video's contents. An explicit standalone-technique title can support a tentative
   technique rejection; an ordinary dish title cannot. The user can override it. Missing narration is common in useful cooking demonstrations.
4. **Nothing usable after the bounded attempt:** stop before recipe normalization
   when there is no eligible textual evidence. If the only result is an uncertain
   visual impression, show an incomplete/unavailable outcome rather than creating
   ingredients from the dish name. Do not download a decorative cover for a
   rejected import.
5. **Some supported facts:** normalize those facts once, retain omissions and
   conflicts, and present a partial draft. A missing quantity or oven temperature
   is a source gap, not a reason to add a plausible value or erase useful steps.

For Gemini YouTube input, official docs describe public-video support, configurable
clipping/frame sampling, and default sampling that can miss rapid changes. Video
tokens grow with duration, frame rate and resolution. Lower resolution can save
tokens while making small labels harder to read. Use current model-specific
limits and inspect actual usage; do not advertise unlimited free processing.
[Gemini video documentation](https://ai.google.dev/gemini-api/docs/video-understanding)
supports a bounded fallback, not a guarantee that every frame or measurement will
be understood. Sampled inspection that misses a step should produce uncertainty.

Schema-constrained model output makes decisions easier to validate and integrate;
it does not establish that the extracted facts are true. Gemini documents
[structured classification and extraction](https://ai.google.dev/gemini-api/docs/structured-output).
Our application must still check references, reject unsupported additions, and
preserve review. Treat instructions found inside captions/pages as source data,
never as permission to change the extraction rules or call unrelated tools.

## Outcomes and recovery

Keep the existing durable job lifecycle initially. Add a result/reason field when
needed rather than overloading every queue status with content judgments.

| Content outcome | Meaning | User-facing recovery |
| --- | --- | --- |
| `wrong_target` | A profile, collection, search page, or malformed supported link | “Paste a link to the individual recipe, post, or video.” |
| `not_recipe` | Readable source positively indicates unrelated content or a standalone technique rather than a dish recipe | “This source doesn't appear to contain a recipe.” Offer another link and an optional user-requested retry where classification was uncertain. |
| `source_unavailable` | Access, private/deleted content, region block, or retrieval failure | “We couldn't read this source.” Retry or use the creator's public recipe page; never say there is no recipe. |
| `insufficient_evidence` | Cooking may be shown, but no usable source-backed ingredient/step text was recovered | Explain the missing detail and offer a better source or manual entry. |
| `partial_recipe` | Some verified recipe content with omissions/conflicts | Review supported lines with specific warnings; fill missing details manually. |
| `recipe_ready` | Ingredients and steps were recovered | Review before saving; this label is not a completeness guarantee. |
| `limit_reached` / `provider_error` | Quota, timeout, or provider failure | Preserve source and explain retry timing; do not misclassify content. |

“This video has music but no readable quantities or spoken instructions” is useful
only when that coverage was actually checked. Otherwise say “We couldn't recover
enough recipe details.” Never claim to have inspected all frames after sampling.

## Optional alternatives are different recipes

If a cooking video is incomplete, offer **Find a similar recipe online** as an
explicit opt-in action. Explain that the result is an alternative, not the
creator's missing instructions. Search using a user-confirmed dish name when the
video's identity is uncertain. Do not automatically search after every failed
import or silently spend another model/search budget.

If in-app alternative cards are added later, show each title, publisher, and direct URL. The level-one implementation opens a normal search page only after the user clicks. Fetch and extract the
chosen page through the normal pipeline. Its saved source and evidence must point
to that page. The original video may be retained separately as inspiration, never
as the citation for the alternative's quantities or method. Do not merge facts
from unrelated recipes into the original draft or infer dietary/calorie claims.

## Acceptance matrix

These are proposed tests at the app's existing import seam, not completed results.
Assert expensive-call counts as well as the visible outcome so the gate's purpose
is verifiable.

| Fixture / scenario | Expected result and cost behavior |
| --- | --- |
| YouTube channel/profile/search/playlist without video | `wrong_target`; zero media/AI calls. |
| YouTube watch URL containing both `v` and `list` | Process that video only; never expand the playlist. |
| Tracking variants of an existing post | Same durable import; no duplicate paid extraction. |
| Short TikTok URL resolving to a real post | Public redirect checks, then normal extraction. |
| Valid post redirecting to login | `source_unavailable`; no false `not_recipe`. |
| Website with complete JSON-LD recipe | Deterministic draft, no recipe-generation call. |
| Generic homepage containing a complete recipe | Positive evidence wins over a pathname heuristic. |
| Multi-recipe roundup | Ask for a specific recipe or retain the current explicit first-recipe warning; never combine recipes. |
| Clearly unrelated readable article | Stop after cheap evidence assessment; no frames/ASR/recipe-generation call. |
| Explicit wrapping/sharpening/chopping tutorial | Stop at preflight when explicit source text supports technique; otherwise classify during normalization and retain failure usage. |
| Real burrito recipe containing wrapping steps; unmeasured partial CrunchWrap | Preserve actual dish ingredients/preparation and missing-detail warnings; do not reject merely for technique words or missing quantities. |
| Terse or non-English recipe caption | `unknown`/positive; no English-keyword rejection. |
| Music-only cooking video with legible ingredient overlays | Use OCR/video fallback; retain supported text and omissions. |
| Music-only video showing food but no recoverable text | `insufficient_evidence`; no invented quantities or cooking times. |
| Caption contains only song lyrics; video not yet read | `unknown`; the transcript does not prove nonrecipe. |
| Ingredient-only caption | Partial draft with missing-method warning, no fabricated steps. |
| Transcript says one amount; overlay says another | Partial draft with explicit conflict; do not silently choose. |
| Recipe says “see notes,” notes inaccessible | Preserve reference and missing-notes warning. |
| Page unavailable / private video / HTTP 429 | Access/provider outcome, never content rejection. |
| Oversized source / redirect to private address | Existing fetch guard stops it before model processing. |
| Prompt-injection text inside a caption | Treat it as data; no extra tools, secrets, or instructions. |
| User chooses an alternative after failed extraction | Separate source URL and evidence; original draft is not overwritten. |

Record stage, reason code, source coverage, elapsed time, provider/model, and actual
token usage when available. Use the user-supplied cooking examples plus a small
negative and silent-video set to check false negatives before expanding the gate.
Avoid adding a second full-video classification call: when video analysis is
already necessary, request classification/coverage alongside its evidence output.

## Checked evidence this round

Unit/integration tests verify wrong-target rejection before a job exists, quoted relevance decisions, truncated-input fallback, user-authorized relevance override, retry fencing/cooldown, source-reference preservation and typed recovery hints. Live bounded text probes classified an unrelated laptop review as unrelated, explicit egg instructions as recipe, and a sparse biryani cooking caption as unknown. The deployed media worker returned CrunchWrap narration in 16.4 seconds with Gemini 3.6 Flash. Full hosted import acceptance is recorded separately in `production-plan.md`.

Known next improvements: reuse metadata across the preflight and analysis service calls; record structured source-coverage flags across every provider; add broader multilingual/negative fixtures; recognize short-link duplicates after redirect resolution; and offer verified in-app search results if requested. Raw-media extraction can still be blocked by platform changes. Browser tests do not establish iPhone or App Store acceptance.

### Recipe-versus-technique correction

The supplied wrapping tutorial was initially accepted and saved during testing; that was a scope error, not a successful recipe import. The correction adds both gates described above. A live provider probe classified **How to wrap a perfect burrito** as technique (337 input / 21 output tokens), classified its retained hosted transcript as technique with an exact opening-sentence quote (1,073 / 561 tokens), and retained partial real CrunchWrap speech as a recipe with three ingredients, four steps and missing-amount/assembly warnings (885 / 380 tokens). These are direct provider checks; fresh hosted acceptance of the correction is a separate release check. Regression tests exercise the `importRecipe` interface with the actual tutorial transcript, partial dish preparation, a burrito recipe containing wrapping, explicit override and bounded failure audit.
