import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/api/**',
        'src/storage/**',
        'src/services/**',
        'src/utils/**',
        'src/server/**',
        'src/config.ts',
      ],
      exclude: [
        'src/client/**',
        'src/providers/**',
        '**/*.d.ts',
      ],
    },
  },
})
