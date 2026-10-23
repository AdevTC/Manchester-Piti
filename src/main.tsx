import { createRoot, hydrateRoot } from 'react-dom/client'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './styles/tailwind.css'
import './styles/fonts.css'
import './index.css'
import './styles/theme.css'
import { Root } from './Root'
import { queryClient } from './lib/queryClient'
import { primeFromBundle, takeInlineBundle } from './lib/bundle'
import { MATCHES_KEY, primePublicData } from './lib/publicData'
import { seedPublicData } from './lib/publicSeed'
import { serverNow, setPaintedAt } from './lib/serverTime'
import { createAppRouter } from './router'
import { startAppUpdates } from './lib/appUpdate'
import { tapsSkipTransitions } from './components/celeste/pageTransition'

// The data bundle (inside a server-rendered page, or downloading since the HTML): the page paints from it
// without Firebase, which loads after the first paint (lib/fb) and gets the same documents in its local cache
// before its listeners open. (A downloaded one seeds the page unless the listeners got there first.)
const inline = takeInlineBundle()
primeFromBundle(inline?.text, (bytes) => {
  if (queryClient.getQueryData(MATCHES_KEY) === undefined) seedPublicData(queryClient, bytes, serverNow())
})

const router = createAppRouter()
// (a tap during a page change finishes it and lands where it was meant to)
tapsSkipTransitions()

// The service worker (built only for production) and the move to a new deploy at a safe moment.
if (import.meta.env.PROD && 'serviceWorker' in navigator) startAppUpdates({ router, busy: () => queryClient.isMutating() > 0 })
const html = document.documentElement
const root = document.getElementById('root')!

// Entrance animations stay off for the page that arrived painted (they'd replay on React's copy); the next
// page animates as usual.
const animateFromNextPage = () => {
  const stop = router.subscribe('onResolved', ({ pathChanged }) => {
    if (!pathChanged) return
    html.removeAttribute('data-ssr')
    stop()
  })
}

if (html.hasAttribute('data-ssr') && inline?.at) {
  // The server sent the page already painted (api/render.js), with the data and the instant it painted it
  // at: React takes the server's markup over as it is (no second copy of the page), rendering it first from
  // the same cache (lib/publicSeed) at the same instant (lib/serverTime renderNow), then the live data and
  // the real time come in as ordinary updates. The router renders the tree the server did (no Suspense of
  // its own around the matches), once the page's code is in.
  seedPublicData(queryClient, new TextEncoder().encode(inline.text), inline.at)
  setPaintedAt(inline.at)
  router.ssr = { manifest: undefined }
  void router.load().then(() => {
    hydrateRoot(root, <Root router={router} client={queryClient} />, {
      // A part that didn't match is rendered afresh by React (as a page without the server's copy would be).
      onRecoverableError: (error) => console.error('hydration', error),
    })
    animateFromNextPage()
  })
} else if (html.hasAttribute('data-ssr')) {
  // A painted page without its data (an older deploy's): React replaces it once it can paint the same thing.
  // (A promise chain, not top-level await: that would split the entry into dozens of chunks.)
  void Promise.all([router.load(), primePublicData(queryClient, 4000)]).then(() => {
    createRoot(root).render(<Root router={router} client={queryClient} />)
    animateFromNextPage()
  })
} else {
  createRoot(root).render(
    <>
      <Root router={router} client={queryClient} />
      {import.meta.env.DEV && new URLSearchParams(location.search).has('debug') && <ReactQueryDevtools client={queryClient} initialIsOpen={false} />}
    </>,
  )
}
