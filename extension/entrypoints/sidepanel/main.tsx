import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../theme/theme.css'
import { App } from './app'

const root = document.getElementById('root')
if (root === null) throw new Error('side panel root missing')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
