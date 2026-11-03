import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../theme/theme.css'
import { Report } from './report'

const root = document.getElementById('root')
if (root === null) throw new Error('report root missing')
createRoot(root).render(
  <StrictMode>
    <Report />
  </StrictMode>,
)
