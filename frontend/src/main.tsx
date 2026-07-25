import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TouchKeyboardProvider } from './components/touch/TouchKeyboardContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TouchKeyboardProvider>
      <App />
    </TouchKeyboardProvider>
  </StrictMode>,
)
