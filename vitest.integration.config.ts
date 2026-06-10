import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Integration tests (feat-009): module boundaries exercised against an
// in-memory PGlite Postgres behind the @/db seam. Kept separate from the
// unit config so `npm test` stays unit-only.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // PGlite WASM boot + drizzle-kit pushSchema run once per suite.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
