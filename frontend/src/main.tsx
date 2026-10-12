import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.tsx'
import { applyRiskVariables } from './lib/risk'

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

// The theme is already set by the inline script in index.html.
applyRiskVariables(document.documentElement)

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
