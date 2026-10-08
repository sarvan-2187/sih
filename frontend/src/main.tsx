import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './firebase'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// TEMP(Qrious): QUANTLMS_LANDING_PAGE=1 also switches the app to the violet landing palette (see index.css).
if (import.meta.env.QUANTLMS_LANDING_PAGE === '1') document.documentElement.dataset.palette = 'quantlms'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

