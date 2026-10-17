import { defineConfig, mergeConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import base from './vite.config.ts'

/**
 * Config Vite des e2e à session simulée : alias de `@clerk/clerk-react` vers la
 * doublure locale et clé Clerk factice (le `main.tsx` exige un `pk_`). Le reste
 * (plugins, proxy, tests vitest) est hérité de `vite.config.ts`.
 */
export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: {
        '@clerk/clerk-react': fileURLToPath(
          new URL('./e2e/auth/mocks/clerk-react.tsx', import.meta.url),
        ),
      },
    },
    define: {
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify('pk_test_e2e_mock'),
    },
  }),
)
