// Run after extracting the snapshot's recipes/photos into outputs/deployment/legacy.
// All writes are additive, production IDs are newly assigned, and progress is durable.
import { readFile, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import sharp from "sharp"

const root = new URL("../outputs/deployment/legacy/", import.meta.url)
const rows = JSON.parse(await readFile(new URL("recipes.json", root), "utf8"))
const ledgerFile = new URL("progress.json", root)
let ledger = {}
try { ledger = JSON.parse(await readFile(ledgerFile, "utf8")) } catch (e) { if (e.code !== "ENOENT") throw e }
function run(name, args) {
  const raw = execFileSync("pnpm", ["exec", "convex", "run", name, JSON.stringify(args), "--prod"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  return raw.trim() ? JSON.parse(raw) : null
}
// Bootstrap the shared library separately with privately supplied invite emails.
// Migration does not create or change access grants.
for (const row of rows) {
  const { _id, _creationTime, imagePath, imageStorageId: oldImage, ...content } = row
  if (run("migrations:existing", { legacyId: _id })) { console.log("Already migrated:", content.name); continue }
  let photo = ledger[_id]
  if (imagePath && !photo) {
    let bytes
    for (const [size, quality] of [[1440, 78], [1200, 68], [960, 58]]) {
      bytes = await sharp(await readFile(imagePath), { limitInputPixels: 25000000 }).rotate().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).webp({ quality, effort: 4 }).toBuffer()
      if (bytes.length <= 350000) break
    }
    if (bytes.length > 350000) throw new Error("Photo exceeds storage cap: " + content.name)
    const url = run("migrations:uploadUrl", {})
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "image/webp" }, body: bytes })
    if (!response.ok) throw new Error("Photo upload failed: " + response.status)
    const { storageId } = await response.json()
    photo = ledger[_id] = { storageId, bytes: bytes.length }
    await writeFile(ledgerFile, JSON.stringify(ledger, null, 2))
  }
  run("migrations:addRecipe", { ...content, legacyId: _id, ...(photo ? { imageStorageId: photo.storageId } : {}) })
  console.log("Migrated:", content.name, photo ? `${Math.ceil(photo.bytes / 1000)} KB` : "no photo")
}
const sizes = Object.values(ledger).map(p => p.bytes)
console.log(JSON.stringify({ recipes: rows.length, photos: sizes.length, totalBytes: sizes.reduce((a, b) => a + b, 0), maxBytes: Math.max(0, ...sizes) }))
