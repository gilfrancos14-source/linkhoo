/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
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
