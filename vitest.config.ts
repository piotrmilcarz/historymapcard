import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils.ts', 'src/types.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
