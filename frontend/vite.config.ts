/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/* Offline : le service worker ne doit JAMAIS être servi en dev — un SW
   servi sur le serveur de dev parasite l'HMR et contournerait les mocks
   des tests e2e (page.route ne voit pas les fetch émis depuis un SW).
   Double garde-fou avec le `import.meta.env.PROD` de swRegister.ts. */
function blockServiceWorkerInDev(): Plugin {
  return {
    name: 'block-service-worker-in-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sw.js' || req.url?.startsWith('/sw.js?')) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('Service worker désactivé en développement')
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), blockServiceWorkerInDev()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    // jsdom coûte ~7 s à créer : le pool vmThreads réutilise l'environnement
    // d'un worker d'un test à l'autre tout en gardant l'isolation par fichier.
    pool: 'vmThreads',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      reportsDirectory: './coverage',
      // Périmètre : la logique (lib, data, hooks, utils, contextes) et les
      // garde-fous de route. Les pages purement déclaratives restent hors
      // couverture plutôt que d'être diluées avec 0 %.
      include: [
        'src/lib/**',
        'src/data/**',
        'src/hooks/**',
        'src/utils/**',
        'src/contexts/**',
        'src/components/RoleRouteGuard.tsx',
        'src/components/AdminRouteGuard.tsx',
        'src/components/StayCard.tsx',
      ],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
})
