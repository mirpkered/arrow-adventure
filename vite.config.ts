import { defineConfig } from 'vite';

export default defineConfig({
  base: '/arrow-adventure/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
