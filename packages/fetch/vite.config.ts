import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { glob } from 'glob';
import { defineConfig } from 'vite'
import { analyzer } from 'vite-bundle-analyzer';
import dts from 'vite-plugin-dts'

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
    },
    outDir: 'lib',
    rollupOptions: {
      external: [
        'algosdk',
        '@algorandfoundation/algokit-utils',
        '@hey-api/client-fetch',
        'crypto-js',
      ],
      input: Object.fromEntries(
        glob
          .sync('src/**/*.ts')
          .map((file) => {
            return [
              relative(
                'src',
                file.slice(0, file.length - extname(file).length),
              ),
              fileURLToPath(new URL(file, import.meta.url)),
            ];
          }),
      ),
      output: {
        compact: false,
        preserveModules: true,
        entryFileNames: '[name].js',
      },
    },
    sourcemap: true,
    minify: false,
    copyPublicDir: false,
    emptyOutDir: true,
  },
  plugins: [
    process.env.ANALYZE ? analyzer() : undefined,
    dts({ tsconfigPath: './tsconfig.lib.json' }),
  ],
})
