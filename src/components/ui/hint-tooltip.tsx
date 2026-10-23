import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** What Radix's trigger hands its child: aria-describedby, data-state, data-slot, the pointer/focus
    handlers and the ref. */
export type TriggerReport = Record<string, unknown> & { ref?: React.Ref<HTMLElement> }

export interface HintTooltipProps {
  label: React.ReactNode
  side: "top" | "bottom" | "left" | "right"
  /** 300 ms, or 0 right after another hint closed (the root provider's skipDelayDuration, shared in hint.tsx). */
  delayDuration: number
  open: boolean
  onOpenChange: (open: boolean) => void
  report: (props: TriggerReport) => void
}

/** Stands where the trigger's child would be: renders nothing and passes Radix's props and ref to <Hint>,
    which puts them on the real child (already in the page, so it never remounts when this loads). */
function TriggerProxy({ report, ...props }: TriggerReport & { report: HintTooltipProps["report"] }) {
  React.useLayoutEffect(() => report(props))
  return null
}

/** The lazy half of <Hint>: the Radix tooltip itself, loaded on the first hover or focus. */
export function HintTooltip({ label, side, delayDuration, open, onOpenChange, report }: HintTooltipProps) {
  return (
    <TooltipProvider delayDuration={delayDuration} skipDelayDuration={0}>
      <Tooltip open={open} onOpenChange={onOpenChange}>
        <TooltipTrigger asChild>
          <TriggerProxy report={report} />
        </TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
