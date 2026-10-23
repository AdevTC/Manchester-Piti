import * as React from "react"

import type { TriggerReport } from "./hint-tooltip"

type TooltipModule = typeof import("./hint-tooltip")

/** The timings of the provider that used to sit at the app root (<TooltipProvider delayDuration={300}>,
    Radix's default skipDelayDuration). */
const DELAY_MS = 300
const SKIP_DELAY_MS = 300

// The Radix tooltip (≈27 KB gzip) stays out of the first load: it arrives on the first hover or focus.
let tooltipModule: TooltipModule | null = null
let tooltipLoad: Promise<TooltipModule> | null = null
function loadTooltip(): Promise<TooltipModule> {
  tooltipLoad ??= import("./hint-tooltip").then(
    (m) => (tooltipModule = m),
    (error: unknown) => {
      tooltipLoad = null // (offline: the next hover tries again)
      throw error
    }
  )
  return tooltipLoad
}

// The skip delay the shared root provider gave every hint: right after one closes, the next opens at once.
let openDelayed = true
let skipTimer = 0
const delayListeners = new Set<() => void>()
function setOpenDelayed(next: boolean) {
  if (openDelayed === next) return
  openDelayed = next
  delayListeners.forEach((listener) => listener())
}
function sharedOpened() {
  window.clearTimeout(skipTimer)
  setOpenDelayed(false)
}
function sharedClosed() {
  window.clearTimeout(skipTimer)
  skipTimer = window.setTimeout(() => setOpenDelayed(true), SKIP_DELAY_MS)
}
function subscribeDelay(listener: () => void) {
  delayListeners.add(listener)
  return () => {
    delayListeners.delete(listener)
  }
}
const getOpenDelayed = () => openDelayed
const getServerOpenDelayed = () => true

type Cleanup = () => void
function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null): Cleanup | undefined {
  if (typeof ref === "function") {
    const cleanup = ref(value)
    return typeof cleanup === "function" ? cleanup : undefined
  }
  if (ref) ref.current = value
  return undefined
}
function detachRef<T>(ref: React.Ref<T> | undefined, cleanup: Cleanup | undefined) {
  if (cleanup) cleanup()
  else assignRef(ref, null)
}

/** The child's events Radix's trigger listens to. */
const EVENTS = ["onPointerMove", "onPointerLeave", "onPointerDown", "onFocus", "onBlur", "onClick"] as const
type EventName = (typeof EVENTS)[number]
type Handler = (event: React.SyntheticEvent) => void
type Handlers = Partial<Record<EventName, Handler>>
type ChildProps = Handlers & { ref?: React.Ref<HTMLElement> } & Record<string, unknown>
type Attrs = Record<string, unknown>

/** What Radix's trigger puts on the child while closed (so the markup is the same before it loads). */
const CLOSED_ATTRS: Attrs = { "data-slot": "tooltip-trigger", "data-state": "closed" }

function sameAttrs(a: Attrs, b: Attrs) {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]))
}

/** One hint's wiring, outside React's render: the real child gets Radix's ref and handlers (reported by
    the lazy trigger proxy) and, until the module is there, the first activation is taken as Radix's
    trigger would have: a hover opens after the delay counted from that first move, a focus that isn't a
    press opens at once. */
class HintWiring {
  private el: HTMLElement | null = null
  private radixRef: React.Ref<HTMLElement> | undefined = undefined
  private radixCleanup: Cleanup | undefined = undefined
  private radixHandlers: Handlers = {}
  /** The module is mounted for this hint and its trigger wired to the child. */
  private ready = false
  private alive = true
  private pendingTimer = 0
  private wantOpen = false
  private hovering = false
  private pressing = false

  private readonly setMod: (mod: TooltipModule) => void
  private readonly setOpen: (open: boolean) => void
  private readonly setAttrs: React.Dispatch<React.SetStateAction<Attrs>>

  constructor(
    setMod: (mod: TooltipModule) => void,
    setOpen: (open: boolean) => void,
    setAttrs: React.Dispatch<React.SetStateAction<Attrs>>
  ) {
    this.setMod = setMod
    this.setOpen = setOpen
    this.setAttrs = setAttrs
  }

  private composed: { childRef: React.Ref<HTMLElement> | undefined; ref: (el: HTMLElement | null) => Cleanup } | null = null

  /** The child's ref, Radix's (once reported) and ours, composed as the Slot did (the same callback
      while the child's ref stays the same, so React doesn't detach and re-attach it on every render). */
  refFor(childRef: React.Ref<HTMLElement> | undefined): (el: HTMLElement | null) => Cleanup {
    const last = this.composed
    if (last && last.childRef === childRef) return last.ref
    const ref = (el: HTMLElement | null): Cleanup => {
      this.el = el
      const own = assignRef(childRef, el)
      this.radixCleanup = assignRef(this.radixRef, el)
      return () => {
        this.el = null
        detachRef(childRef, own)
        detachRef(this.radixRef, this.radixCleanup)
        this.radixCleanup = undefined
      }
    }
    this.composed = { childRef, ref }
    return ref
  }

  /** The child's handlers merged as the Slot did: the child's own first, then the tooltip's. */
  handlersFor(child: Handlers): Record<EventName, Handler> {
    const out = {} as Record<EventName, Handler>
    for (const name of EVENTS) {
      const own = child[name]
      out[name] = (event) => {
        own?.(event)
        this.onEvent(name, event)
        this.radixHandlers[name]?.(event)
      }
    }
    return out
  }

  /** From the lazy trigger proxy, on every render of Radix's trigger. */
  readonly report = (props: TriggerReport) => {
    const { ref, ...rest } = props
    if (ref !== this.radixRef) {
      if (this.el) detachRef(this.radixRef, this.radixCleanup)
      this.radixRef = ref
      this.radixCleanup = this.el ? assignRef(ref, this.el) : undefined
    }
    const handlers: Handlers = {}
    const next: Attrs = {}
    for (const [key, value] of Object.entries(rest)) {
      if (typeof value === "function") {
        if ((EVENTS as readonly string[]).includes(key)) handlers[key as EventName] = value as Handler
      } else if (value !== undefined) next[key] = value
    }
    this.radixHandlers = handlers
    this.setAttrs((prev) => (sameAttrs(prev, next) ? prev : next))
  }

  /** Radix's open state changes (controlled, so the first open can be ours). */
  readonly onOpenChange = (next: boolean) => {
    if (next) sharedOpened()
    else {
      sharedClosed()
      this.clearTimer()
    }
    this.setOpen(next)
  }

  mount(): Cleanup {
    this.alive = true
    return () => {
      this.alive = false
      this.clearTimer()
    }
  }

  /** The module is mounted and its trigger wired to the child: open if the first activation asked. */
  moduleReady() {
    this.ready = true
    if (this.wantOpen) {
      this.wantOpen = false
      this.openNow()
    }
  }

  private openNow() {
    // (what Radix does when it opens one: the others close, and the skip delay starts)
    document.dispatchEvent(new CustomEvent("tooltip.open"))
    sharedOpened()
    this.setOpen(true)
  }

  private activate() {
    loadTooltip().then(
      (m) => {
        if (this.alive) this.setMod(m)
      },
      () => {}
    )
  }

  private requestOpen() {
    if (this.ready) this.openNow()
    else this.wantOpen = true
  }

  private clearTimer() {
    window.clearTimeout(this.pendingTimer)
    this.pendingTimer = 0
  }

  private cancelPending() {
    this.clearTimer()
    this.wantOpen = false
  }

  private onEvent(name: EventName, event: React.SyntheticEvent) {
    if (event.defaultPrevented) return
    switch (name) {
      case "onPointerMove":
        if (this.ready || (event as React.PointerEvent).pointerType === "touch" || this.hovering) return
        this.hovering = true
        this.activate()
        if (openDelayed) {
          this.clearTimer()
          this.pendingTimer = window.setTimeout(() => {
            this.pendingTimer = 0
            this.requestOpen()
          }, DELAY_MS)
        } else this.requestOpen()
        return
      case "onPointerLeave":
        this.hovering = false
        this.cancelPending()
        return
      case "onPointerDown":
        if (this.ready) return
        this.pressing = true
        document.addEventListener("pointerup", () => (this.pressing = false), { once: true })
        return
      case "onFocus":
        if (this.ready || this.pressing) return
        this.activate()
        this.requestOpen()
        return
      case "onBlur":
      case "onClick":
        this.cancelPending()
        return
    }
  }
}

/** Thin wrapper: a themed tooltip around an icon/control. Replaces native
    `title=` on icon-only buttons. The child stays the real focusable element
    (as Radix's asChild trigger), so layout and aria-label are preserved. Until
    the first hover or focus only the child renders; then the tooltip module
    loads (with its own provider) and shows the tooltip with the same delay,
    counted from that first hover. */
export function Hint({
  label,
  side = "top",
  children,
}: {
  label: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  children: React.ReactNode
}) {
  const [mod, setMod] = React.useState<TooltipModule | null>(() => tooltipModule)
  const [open, setOpen] = React.useState(false)
  const [attrs, setAttrs] = React.useState<Attrs>(CLOSED_ATTRS)
  const [wiring] = React.useState(() => new HintWiring(setMod, setOpen, setAttrs))
  const delayed = React.useSyncExternalStore(subscribeDelay, getOpenDelayed, getServerOpenDelayed)

  React.useEffect(() => wiring.mount(), [wiring])
  // (after the tooltip's own effects: its trigger is wired to the child by then)
  React.useEffect(() => {
    if (mod) wiring.moduleReady()
  }, [mod, wiring])

  const child = React.Children.only(children)
  const isElement = React.isValidElement<ChildProps>(child)
  const childRef = isElement ? child.props.ref : undefined
  const ref = wiring.refFor(childRef)
  if (!isElement) return child

  // The child with Radix's attributes as its asChild Slot gave them: the child's own props win.
  const props: Record<string, unknown> = { ...wiring.handlersFor(child.props), ref }
  for (const [key, value] of Object.entries(attrs)) if (child.props[key] === undefined) props[key] = value

  return (
    <>
      {React.cloneElement(child, props)}
      {mod && (
        <mod.HintTooltip
          label={label}
          side={side}
          delayDuration={delayed ? DELAY_MS : 0}
          open={open}
          onOpenChange={wiring.onOpenChange}
          report={wiring.report}
        />
      )}
    </>
  )
}
