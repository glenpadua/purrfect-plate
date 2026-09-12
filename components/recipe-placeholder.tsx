import { Cat, Utensils } from "lucide-react"
import { cn } from "@/lib/utils"

export function RecipePlaceholder({ className }: { className?: string }) {
  return <div className={cn("flex items-center justify-center bg-[radial-gradient(ellipse_at_top,oklch(0.94_0.07_75),oklch(0.86_0.06_45))] text-[oklch(0.45_0.08_42)]", className)} aria-label="Recipe illustration">
    <div className="relative rounded-full border border-current/15 bg-white/30 p-10"><Cat className="size-16 stroke-[1.3]" /><Utensils className="absolute -right-3 bottom-1 size-8 rotate-12" /></div>
  </div>
}
