import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      // Workaround for vite-plugin-node-polyfills v0.24.0 + Vite 6 build issue
      // See: https://github.com/davidmyersdev/vite-plugin-node-polyfills/issues/81
      external: ['vite-plugin-node-polyfills/shims/buffer'],
    },
  },
})
