import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/index.js'
import './App.css'
import App from './App.jsx'
import ThemeProvider from './theme/ThemeProvider.jsx'
import LanguageSync from './components/LanguageSync.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageSync />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
