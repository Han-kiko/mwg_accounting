import { defineConfig } from 'vitest/config';

// Unit tests run in a plain Node environment; only core logic (e.g. db.ts)
// is tested, no browser needed. better-sqlite3 ships a Node-API binary that
// loads fine outside Electron (see forge.config.ts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
