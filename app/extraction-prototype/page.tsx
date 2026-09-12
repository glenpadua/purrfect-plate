"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowUpRight, Cat, Check, Download, Loader2 } from "lucide-react"
import type { ExtractionJob } from "@/lib/extraction-prototype/types"
import { groupRuns } from "@/lib/extraction-prototype/history"
import "./prototype.css"

type Summary = Pick<ExtractionJob, "id" | "url" | "platform" | "status" | "phase" | "title" | "startedAt" | "finishedAt">
type Overview = { configuration: { localMedia: boolean; supadata: boolean; openai: boolean; model: string }; jobs: Summary[] }
const examples = [
  ["Instagram · breakfast burritos", "https://www.instagram.com/p/Dc_6VZeTJPJ/"],
  ["Instagram · carousel / slide 4", "https://www.instagram.com/p/DdFnOXsDGnV/?img_index=4"],
  ["Instagram · reel", "https://www.instagram.com/reel/DdJyDKhKk1i/"],
  ["YouTube · burrito folding", "https://www.youtube.com/shorts/z1XshOQJmrw"],
  ["YouTube · chicken biryani", "https://www.youtube.com/shorts/GiqOJyy3oWE"],
  ["YouTube · breakfast crunchwrap", "https://www.youtube.com/shorts/_qFZJjnN73o"],
  ["TikTok · mac and cheese", "https://www.tiktok.com/@biteswithesther/video/7351594254663159083"],
  ["Website · chicken & lemon rice", "https://www.recipetineats.com/one-pot-greek-chicken-lemon-rice/"],
]
const labels = { running: "Working", recipe_found: "Recipe found", partial: "Partial result", blocked: "Source blocked", failed: "Run failed" }

async function api(path = "", options?: RequestInit) {
  const response = await fetch(`/api/extraction-prototype${path}`, { ...options, cache: "no-store" })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "The test server did not respond.")
  return data
}

export default function ExtractionPrototype() {
  const [url, setUrl] = useState("")
  const [useProvider, setUseProvider] = useState(false)
  const [useLocalMedia, setUseLocalMedia] = useState(true)
  const [includeFrames, setIncludeFrames] = useState(true)
  const [includeTranscript, setIncludeTranscript] = useState(true)
  const [overview, setOverview] = useState<Overview>()
  const [selectedId, setSelectedId] = useState<string>()
  const [job, setJob] = useState<ExtractionJob>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const resultsRef = useRef<HTMLElement>(null)
  const selected = useRef(selectedId)
  selected.current = selectedId
  const groups = groupRuns(overview?.jobs || [])
  const selectedGroup = groups.find((group) => group.runs.some((run) => run.id === selectedId))

  useEffect(() => {
    let disposed = false
    const refresh = async () => {
      try {
        const result: Overview = await api()
        if (!disposed) setOverview(result)
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : "Could not load test runs.") }
    }
    void refresh()
    const timer = setInterval(refresh, 2500)
    return () => { disposed = true; clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    if (window.matchMedia("(max-width: 650px)").matches) resultsRef.current?.scrollIntoView({ block: "start" })
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      try {
        const result: ExtractionJob = await api(`?id=${encodeURIComponent(selectedId)}`)
        if (!disposed && selected.current === selectedId) {
          setJob(result)
          if (result.status === "running") timer = setTimeout(refresh, 1500)
        }
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : "Could not load the selected run.") }
    }
    setJob(undefined)
    void refresh()
    return () => { disposed = true; clearTimeout(timer) }
  }, [selectedId])

  async function start() {
    setError(""); setSubmitting(true)
    try {
      const result: ExtractionJob = await api("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, useProvider, includeTranscript, useLocalMedia, includeFrames }) })
      setSelectedId(result.id)
      setOverview(await api())
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start the test.") }
    finally { setSubmitting(false) }
  }

  return <main className="extraction-lab">
    <Link href="/" className="lab-back"><ArrowLeft size={16} /> Recipe library</Link>
    <header className="lab-header">
      <div><p className="lab-eyebrow">PURRFECT PLATE / EXTRACTION EXPERIMENT</p><h1>Let’s see what<br />the cat brings back.</h1><p className="lab-intro">One real link. The original evidence. A recipe we can check.</p></div>
      <Cat className="lab-cat" strokeWidth={1.1} aria-hidden="true" />
    </header>
    <div className="lab-layout">
      <aside className="lab-controls">
        <form onSubmit={(e) => { e.preventDefault(); void start() }}>
          <label htmlFor="recipe-url" className="lab-label">Recipe link</label>
          <input id="recipe-url" type="url" required placeholder="https://www.instagram.com/p/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="lab-submit" disabled={submitting || !url.trim()}>{submitting ? <Loader2 size={18} className="lab-spin" /> : <ArrowUpRight size={18} />} {submitting ? "Starting…" : "Test extraction"}</button>
          <details className="lab-options"><summary>Test options</summary>
            <label><input type="checkbox" checked={useLocalMedia} onChange={(e) => setUseLocalMedia(e.target.checked)} /> Retrieve media with local open-source tools</label>
            <label><input type="checkbox" checked={includeFrames} onChange={(e) => setIncludeFrames(e.target.checked)} /> Read video frames and show visual observations</label>
            <label><input type="checkbox" checked={useProvider} onChange={(e) => setUseProvider(e.target.checked)} /> Try social provider after direct access</label>
            <label><input type="checkbox" checked={includeTranscript} onChange={(e) => setIncludeTranscript(e.target.checked)} /> Retrieve / generate video transcript</label>
            <p>Provider calls use your API credits. Transcription can take a few minutes. Image posts use text recognition when available.</p>
          </details>
        </form>
        {error && <p role="alert" className="lab-error">{error}</p>}
        <details className="lab-examples" open><summary>Our test links</summary>{examples.map(([label, value]) => <button key={value} onClick={() => setUrl(value)}>{label}<ArrowUpRight size={14} /></button>)}</details>
        <div className="lab-config"><p className="lab-label">Connections</p><p><span className="lab-dot" />Public pages <strong>Ready</strong></p><p><span className={`lab-dot ${overview?.configuration.localMedia ? "" : "off"}`} />Local media worker <strong>{overview?.configuration.localMedia ? "Ready" : "Setup needed"}</strong></p><p><span className={`lab-dot ${overview?.configuration.supadata ? "" : "off"}`} />Supadata fallback <strong>{overview?.configuration.supadata ? "Configured" : "Optional"}</strong></p><p><span className={`lab-dot ${overview?.configuration.openai ? "" : "off"}`} />AI extraction <strong>{overview?.configuration.openai ? "Configured" : "Key needed"}</strong></p>
          <details><summary>Server setup</summary><p>Run <code>node scripts/setup-extraction-worker.mjs</code> for local retrieval. Set <code>OPENAI_API_KEY</code> in the server’s <code>.env.local</code> for speech and image analysis. <code>SUPADATA_API_KEY</code> is an optional managed fallback. Never paste keys here.</p></details>
        </div>
        <p className="lab-footnote">Local prototype. Runs stay in server memory for up to an hour and disappear on restart. Download evidence you want to keep. Nothing is added to your recipe library.</p>
      </aside>
      <section ref={resultsRef} className="lab-workspace" aria-label="Extraction results">
        {!!groups.length && <div className="lab-runs" aria-label="Recent sources">{groups.map(({ key, latest: run, runs }) => <button key={key} className={selectedGroup?.key === key ? "selected" : ""} onClick={() => { setError(""); setSelectedId(run.id) }}><span>{run.platform}</span><strong>{run.title || new URL(run.url).pathname}</strong><small>{labels[run.status]}{runs.length > 1 ? ` · ${runs.length} attempts` : ""}</small></button>)}</div>}
        {selectedGroup && selectedGroup.runs.length > 1 && <details className="lab-history"><summary>Run history · {selectedGroup.runs.length} attempts{selectedId !== selectedGroup.latest.id ? " · viewing an earlier attempt" : ""}</summary><ul>{selectedGroup.runs.map((run, index) => <li key={run.id}><button aria-current={selectedId === run.id ? "true" : undefined} onClick={() => { setError(""); setSelectedId(run.id) }}>{index === 0 ? "Latest" : "Earlier"} · {new Date(run.startedAt).toLocaleTimeString()} · {labels[run.status]}</button></li>)}</ul></details>}
        {!job ? <div className="lab-empty"><span>01 / FOLLOW THE EVIDENCE</span><h2>{selectedId ? "Loading this run…" : "A link is the starting point."}</h2><p>We’ll separate what the source gives us from what the extractor can turn into a recipe. Missing ingredients stay missing.</p><ol><li>Read the caption, page or transcript</li><li>Extract ingredients and instructions</li><li>Compare every line with its source</li></ol></div> : <>
          <div className="lab-result-header"><div><p className="lab-eyebrow">{job.platform} / {labels[job.status]}</p><h2>{job.recipe?.title || job.title || "Checking your link"}</h2><p aria-live="polite" className="lab-phase">{job.status === "running" && <Loader2 size={16} className="lab-spin" />}{job.phase}</p></div><a className="lab-download" href={`/api/extraction-prototype?id=${job.id}&download=1`} download aria-label="Download run evidence"><Download size={18} /> JSON</a></div>
          <a className="lab-source" href={job.url} target="_blank" rel="noreferrer">Open original source <ArrowUpRight size={14} /></a>
          {job.recipe && <div className="lab-recipe"><div><h3>Ingredients <span>{job.recipe.ingredients.length}</span></h3>{job.recipe.ingredients.length ? <ul>{job.recipe.ingredients.map((item, i) => <li key={i}>{item.text}<a href={`#evidence-${item.sourceId}`} title="See source evidence" onClick={() => document.getElementById(`evidence-${item.sourceId}`)?.setAttribute("open", "")}>↗</a></li>)}</ul> : <p>No ingredient list found in the source.</p>}</div><div><h3>Instructions <span>{job.recipe.steps.length}</span></h3>{job.recipe.steps.length ? <ol>{job.recipe.steps.map((item, i) => <li key={i}>{item.text.replace(/^\d+[.)]\s*/, "")}<a href={`#evidence-${item.sourceId}`} title="See source evidence" onClick={() => document.getElementById(`evidence-${item.sourceId}`)?.setAttribute("open", "")}>↗</a></li>)}</ol> : <p>No cooking steps found in the source.</p>}</div></div>}
          {!!job.warnings.length && <div className="lab-notes"><h3>Things to check</h3><ul>{job.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div>}
          <div className="lab-evidence"><h3>Retrieved evidence <span>{job.evidence.length}</span></h3>{job.evidence.length ? job.evidence.map((e) => <details id={`evidence-${e.id}`} key={e.id}><summary><span>{e.kind.replaceAll("_", " ")}</span>{e.via}<small>{e.text.length.toLocaleString()} characters</small></summary><pre>{e.text}</pre></details>) : <p>No usable source content retrieved yet.</p>}</div>
          <details className="lab-log" open={!job.recipe}><summary>Extraction log & usage</summary><ul>{job.attempts.map((a, i) => <li key={i}><span>{a.outcome === "ok" ? <Check size={15} /> : "—"}</span><div><strong>{a.stage}</strong><p>{a.detail}</p></div><small>{(a.elapsedMs / 1000).toFixed(1)}s</small></li>)}</ul><p>Provider credits reported: {job.providerCredits ?? "not reported / not used"}. {job.aiUsage ? `AI: ${job.aiUsage.model}, ${job.aiUsage.inputTokens} input / ${job.aiUsage.outputTokens} output tokens.` : "No AI usage recorded."}</p><p>Started {new Date(job.startedAt).toLocaleTimeString()}{job.finishedAt ? ` · finished ${new Date(job.finishedAt).toLocaleTimeString()}` : ""}. Recipe found means ingredients and steps were extracted; it still needs human comparison with the original.</p></details>
        </>}
      </section>
    </div>
  </main>
}
