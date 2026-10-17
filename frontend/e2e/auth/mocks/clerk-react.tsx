/**
 * Doublure de `@clerk/clerk-react` pour les e2e à session simulée.
 *
 * Montée uniquement par `vite.auth.config.ts` (alias de résolution) : le code
 * de production et les autres specs continuent d'utiliser le vrai paquet. Le
 * rôle et l'état de connexion sont lus dans `localStorage['e2e:auth']`, posés
 * par `page.addInitScript` avant chaque navigation.
 */
import type { ReactNode } from 'react';

interface E2EAuth {
  signedIn: boolean;
  role: 'client' | 'gerant' | null;
}

const STORAGE_KEY = 'e2e:auth';
const TOKEN = 'e2e-token';

function readAuth(): E2EAuth {
  if (typeof window === 'undefined') return { signedIn: false, role: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { signedIn: false, role: null };
    const parsed = JSON.parse(raw) as Partial<E2EAuth>;
    return { signedIn: parsed.signedIn ?? false, role: parsed.role ?? null };
  } catch {
    return { signedIn: false, role: null };
  }
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  const { signedIn, role } = readAuth();
  return {
    isLoaded: true,
    isSignedIn: signedIn,
    userId: signedIn ? `e2e-${role ?? 'user'}` : null,
    sessionId: signedIn ? 'e2e-session' : null,
    getToken: async () => (signedIn ? TOKEN : null),
    signOut: async () => {
      window.localStorage.removeItem(STORAGE_KEY);
    },
  };
}

export function useUser() {
  const { signedIn, role } = readAuth();
  const email = `${role ?? 'user'}@e2e.test`;
  const user = signedIn
    ? {
        id: `e2e-${role ?? 'user'}`,
        firstName: role === 'gerant' ? 'Gérard' : 'Client',
        lastName: 'Test',
        fullName: role === 'gerant' ? 'Gérard Test' : 'Client Test',
        username: `e2e-${role ?? 'user'}`,
        imageUrl: '',
        primaryEmailAddress: { emailAddress: email },
        emailAddresses: [{ emailAddress: email }],
        publicMetadata: { role },
        unsafeMetadata: {},
      }
    : null;
  return { isLoaded: true, isSignedIn: signedIn, user };
}

export function useClerk() {
  return {
    signOut: async () => {
      window.localStorage.removeItem(STORAGE_KEY);
    },
  };
}

/** Les pages de connexion ne sont pas exercées par ces specs. */
export function SignIn() {
  return <div data-testid="e2e-signin" />;
}

export function SignUp() {
  return <div data-testid="e2e-signup" />;
}
