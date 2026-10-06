import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { MotionConfig } from 'motion/react'
import './styles/tailwind.css'
import './styles/fonts.css'
import './index.css'
import './styles/theme.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'
import { primeFromBundle } from './lib/bundle'
import { primePublicData } from './lib/publicData'
import { createAppRouter } from './router'

// Before React renders: the data bundle (already downloading since the HTML) goes into the cache.
primeFromBundle()

const router = createAppRouter()
const html = document.documentElement

const mount = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <App router={router} />
          {import.meta.env.DEV && new URLSearchParams(location.search).has('debug') && <ReactQueryDevtools initialIsOpen={false} />}
        </MotionConfig>
      </QueryClientProvider>
    </StrictMode>,
  )

// The server sent the page already painted (api/render.js). React takes over only once it can paint
// the same thing: the page's code and the public data are ready. Until then the server's HTML stays.
// (A promise chain, not top-level await: that would split the entry into dozens of chunks.)
if (html.hasAttribute('data-ssr')) {
  void Promise.all([router.load(), primePublicData(queryClient, 4000)]).then(() => {
    mount()
    // Entrance animations stay off for the page that arrived painted (they'd replay on React's copy);
    // the next page animates as usual.
    const stop = router.subscribe('onResolved', ({ pathChanged }) => {
      if (!pathChanged) return
      html.removeAttribute('data-ssr')
      stop()
    })
  })
} else {
  mount()
}
