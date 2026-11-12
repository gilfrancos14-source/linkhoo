import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // La suite importe l'application complète (routes, Clerk, pawaPay, modèle
    // d'analyse d'images) et touche bcrypt : sur une machine chargée, les
    // délais par défaut (5 s / 10 s) provoquent des timeouts qui n'ont rien
    // à voir avec un défaut du code.
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // 90 fichiers de test lancés en parallèle saturent le CPU et la mémoire :
    // les timeouts apparaissent par pure contention. 8 workers sur une
    // machine 4 cœurs est un meilleur compromis durée/stabilité.
    maxWorkers: 8,
    minWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      reportsDirectory: './coverage',
      include: ['src/routes/**', 'src/validations/**', 'src/middleware/**', 'src/utils/**'],
      exclude: ['**/*.test.ts', 'src/smoke/**'],
    },
  },
});
