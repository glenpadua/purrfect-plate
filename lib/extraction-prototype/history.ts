import { sourceKey } from "../recipe-import/source-key"
export { sourceKey } from "../recipe-import/source-key"

// The API supplies newest runs first. Keep every attempt inside its source group.
export function groupRuns<T extends { url: string }>(runs: T[]) {
  const groups = new Map<string, { key: string; latest: T; runs: T[] }>()
  for (const run of runs) {
    const key = sourceKey(run.url)
    const group = groups.get(key)
    if (group) group.runs.push(run)
    else groups.set(key, { key, latest: run, runs: [run] })
  }
  return [...groups.values()]
}
