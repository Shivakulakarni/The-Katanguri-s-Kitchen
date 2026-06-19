import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'node_modules', 'dist'],
    setupFiles: ['src/test-setup.ts'],
  },
});
