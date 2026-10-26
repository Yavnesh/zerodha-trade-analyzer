import { defineConfig } from 'vite';

// Base URL allows flexible deployment to GitHub Pages or custom domain
// If DEPLOY_BASE is provided in environment, use it, else default to './' for relative paths
export default defineConfig({
  base: process.env.BASE_URL || './',
  test: {
    environment: 'node',
    globals: true,
  },
});
