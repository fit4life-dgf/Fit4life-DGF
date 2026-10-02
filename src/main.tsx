import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { AppLockGate } from './components/profile/AppLockGate'
import { NavProvider } from './contexts/NavContext'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NavProvider>
          <AppLockGate><App /></AppLockGate>
        </NavProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
