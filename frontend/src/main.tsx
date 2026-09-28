import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkReady = Boolean(clerkPubKey && clerkPubKey.startsWith('pk_'));

function ClerkShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  if (!clerkReady) {
    return (
      <div className="auth-loading" role="alert" style={{ minHeight: '100vh', textAlign: 'center' }}>
        <div className="auth-loading__spinner" />
        <p><strong>Configuration manquante</strong></p>
        <p>
          La variable <code>VITE_CLERK_PUBLISHABLE_KEY</code> est absente ou invalide.
          L&apos;application ne peut pas démarrer sans authentification.
        </p>
      </div>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

function Root() {
  return (
    <BrowserRouter>
      <ClerkShell>
        <App />
      </ClerkShell>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)