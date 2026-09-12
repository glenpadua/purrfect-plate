const tagHues = [18, 48, 78, 138, 178, 228, 288, 328]

export function tagTone(tag: string, isSelected = false) {
  const hash = Array.from(tag).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  )
  const hue = tagHues[hash % tagHues.length]

  return {
    backgroundColor: isSelected
      ? `oklch(0.88 0.075 ${hue})`
      : `oklch(0.92 0.055 ${hue})`,
    color: `oklch(0.28 0.07 ${hue})`,
    borderColor: isSelected
      ? `oklch(0.48 0.09 ${hue})`
      : `oklch(0.78 0.07 ${hue})`,
    boxShadow: isSelected
      ? `inset 0 0 0 1px oklch(0.36 0.08 ${hue} / 0.5)`
      : undefined,
  }
}
