import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    exclude: [
      'src/app/components/verification-dialog/**',
      'src/app/pages/admin/modules/**',
      'src/app/components/admin-prayer-approval/**',
      'src/app/components/admin-update-approval/**',
      'src/app/components/pending-prayer-card/**',
      'src/app/components/pending-update-card/**',
      'src/app/components/prayer-display-card/**',
      'src/app/components/site-protection-settings/**',
      'src/app/components/tenant-switcher-dropdown/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/test-setup.ts',
        'src/environments/**',
      ],
    },
  },
});
