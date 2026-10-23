import * as React from "react"
import type { ToasterProps } from "sonner"

import { subscribeToasterWanted, toasterMounted, toasterWanted } from "@/lib/toast"

const LazyToaster = React.lazy<React.ComponentType<ToasterProps>>(() =>
  import("./sonner").then(
    (m) => ({ default: m.Toaster }),
    // (a chunk that fails to load leaves no toaster instead of breaking the page)
    () => ({ default: () => null })
  )
)

function MountedSignal() {
  React.useEffect(() => toasterMounted(), [])
  return null
}

/** The app's <Toaster> (components/ui/sonner), loaded and mounted in its place once the first toast
    (lib/toast) asks for it, so sonner stays out of the first load. */
export function Toaster(props: ToasterProps) {
  const wanted = React.useSyncExternalStore(subscribeToasterWanted, toasterWanted, () => false)
  if (!wanted) return null
  return (
    <React.Suspense fallback={null}>
      <LazyToaster {...props} />
      <MountedSignal />
    </React.Suspense>
  )
}
