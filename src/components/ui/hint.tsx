import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** Thin wrapper: a themed tooltip around an icon/control. Replaces native
    `title=` on icon-only buttons. The child stays the real focusable element
    (asChild), so layout and aria-label are preserved. Requires a
    <TooltipProvider> ancestor (mounted once at the app root). */
export function Hint({
  label,
  side = "top",
  children,
}: {
  label: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
