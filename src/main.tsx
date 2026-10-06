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

// Before React renders: the data bundle (already downloading since the HTML) goes into the cache.
primeFromBundle()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <App />
        {import.meta.env.DEV && new URLSearchParams(location.search).has('debug') && <ReactQueryDevtools initialIsOpen={false} />}
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)
