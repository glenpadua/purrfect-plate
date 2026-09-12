"use client"

import { Fragment, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ingredientForCooking, servingCount, type CookingUnits } from "@/lib/cooking"
import type { RecipeLine } from "@/lib/recipe-lines"

/** A view of a recipe for this cooking session; adjustments never save over it. */
export function CookingPanel({ ingredients = [], instructions = [], recipeNotes = [], servings }: {
  ingredients?: RecipeLine[]; instructions?: RecipeLine[]; recipeNotes?: RecipeLine[]; servings?: string
}) {
  const base = servingCount(servings)
  const [target, setTarget] = useState(String(base ?? ""))
  const [units, setUnits] = useState<CookingUnits>("original")
  const [requestedStep, setStep] = useState<number | null>(null)
  const step = requestedStep === null || !instructions.length ? null : Math.min(requestedStep, instructions.length - 1)
  const heading = useRef<HTMLHeadingElement>(null)
  const start = useRef<HTMLButtonElement>(null)
  const targetCount = Number(target)
  const validTarget = Number.isInteger(targetCount) && targetCount >= 1 && targetCount <= 100
  const factor = base && validTarget ? targetCount / base : 1
  const adjusted = factor !== 1 || units !== "original"
  const displayed = ingredients.map(item => ingredientForCooking(item.text, { factor, units }))
  function goTo(next: number | null) {
    setStep(next)
    requestAnimationFrame(() => next === null ? start.current?.focus() : heading.current?.focus())
  }
  return <div className="space-y-5">
    <section className="rounded-lg border bg-card p-5" aria-label="Cooking preferences">
      <div className="flex flex-wrap items-end gap-4">
        {base ? <label className="grid gap-2 text-sm font-medium">Cook for<input aria-label="Cook for" className="h-10 w-24 rounded-md border bg-background px-3" type="number" min={1} max={100} step={1} value={target} onChange={event => setTarget(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Original: {base} servings</span></label> : <p className="text-sm text-muted-foreground">Add a clear serving count when editing to adjust portions.</p>}
        <label className="grid gap-2 text-sm font-medium">Units<select className="h-10 rounded-md border bg-background px-3" value={units} onChange={event => setUnits(event.target.value as CookingUnits)}><option value="original">As written</option><option value="metric">Metric (g / mL)</option><option value="us">US (oz / cups)</option></select></label>
        {instructions.length && step === null ? <Button ref={start} onClick={() => goTo(0)}>Start cook mode</Button> : null}
        {adjusted ? <Button variant="ghost" onClick={() => { setTarget(String(base ?? "")); setUnits("original") }}>Reset adjustments</Button> : null}
      </div>
      {base && !validTarget ? <p role="alert" className="mt-3 text-sm text-destructive">Enter a whole number from 1 to 100. Showing original portions.</p> : null}
      {adjusted ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Amounts are approximate. Cooking times and amounts written in the method stay as written. Check the ingredient list for adjusted amounts. Unclear quantities stay unchanged; cups and spoons convert only when explicitly labeled US. No weight-to-volume guesses.</p> : null}
    </section>
    {step !== null && instructions[step] ? <section className="rounded-lg border-2 border-primary/40 bg-card p-6" aria-label="Cook mode">
      <div className="flex items-center justify-between gap-4"><h2 ref={heading} tabIndex={-1} className="text-2xl">Step {step + 1} of {instructions.length}</h2><Button variant="ghost" onClick={() => goTo(null)}>Exit cook mode</Button></div>
      {instructions[step].group ? <p className="mt-4 font-medium">{instructions[step].group}</p> : null}
      <p className="my-8 whitespace-pre-line text-xl leading-9">{instructions[step].text}</p>
      <div className="flex justify-between gap-3"><Button variant="outline" disabled={step === 0} onClick={() => goTo(step - 1)}>Previous step</Button>{step < instructions.length - 1 ? <Button onClick={() => goTo(step + 1)}>Next step</Button> : <Button onClick={() => goTo(null)}>Finish cook mode</Button>}</div>
    </section> : null}
    {ingredients.length ? <section className="rounded-lg border bg-card p-5"><h2 className="mb-4 text-2xl">Ingredients</h2><ul>{ingredients.map((item, index) => <Fragment key={index}>
      {item.group && item.group !== ingredients[index - 1]?.group ? <li className="pb-1 pt-5 font-semibold">{item.group}</li> : null}
      <li className="border-b py-3 text-sm leading-6 last:border-0"><label className="flex items-start gap-3"><input type="checkbox" className="mt-1.5 accent-primary" /><span>{displayed[index].text}{adjusted && displayed[index].text !== item.text ? <span className="block text-xs text-muted-foreground">Original: {item.text}</span> : adjusted && displayed[index].unchanged ? <span className="block text-xs text-muted-foreground">As written — check this amount</span> : null}</span></label></li>
    </Fragment>)}</ul></section> : null}
    {instructions.length && step === null ? <section className="rounded-lg border bg-card p-5"><h2 className="mb-5 text-2xl">Method</h2><ol className="space-y-6">{instructions.map((item, index) => <li key={index} className="flex gap-4 text-sm leading-7"><span className="font-semibold text-primary">{index + 1}.</span><div>{item.group && item.group !== instructions[index - 1]?.group ? <p className="font-semibold">{item.group}</p> : null}<p>{item.text}</p></div></li>)}</ol></section> : null}
    {recipeNotes.length ? <section className="rounded-lg border bg-card p-5"><h2 className="mb-4 text-2xl">Recipe notes</h2><div className="space-y-3 text-sm leading-7">{recipeNotes.map((note, index) => <p key={index}>{note.text}</p>)}</div></section> : null}
  </div>
}
