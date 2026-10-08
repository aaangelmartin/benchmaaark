import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './index.css'

// posters measure text with canvas, so the font has to be ready first
await Promise.all([500, 600, 700].map((w) => document.fonts.load(`${w} 16px Outfit`)))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
