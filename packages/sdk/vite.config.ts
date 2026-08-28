import { promises as fs } from 'fs'
import { resolve } from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const entryNames = ['index', 'lookup']

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        lookup: resolve(__dirname, 'src/lookup-entry.ts'),
      },
    },
    outDir: 'dist',
    rollupOptions: {
      external: ['algosdk', '@algorandfoundation/algokit-utils'],
      output: [
        {
          format: 'es',
          dir: 'dist/esm',
          entryFileNames: '[name].js',
          preserveModules: false,
          exports: 'named',
          // Split the large contract clients into a separate chunk. This is
          // only reachable from the main `index` entry; the `lookup` entry
          // never imports the generated typed clients.
          manualChunks: {
            'nfd-contracts': [
              'src/contracts/NFDInstanceClient.ts',
              'src/contracts/NFDRegistryClient.ts',
            ],
          },
        },
        {
          format: 'cjs',
          dir: 'dist/cjs',
          entryFileNames: '[name].cjs',
          preserveModules: false,
          exports: 'named',
        },
      ],
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      onwarn(warning, warn) {
        // Ignore warnings about unused external imports
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        warn(warning)
      },
    },
    sourcemap: true,
    minify: true,
  },
  plugins: [
    dts({
      outDir: 'dist/types',
      rollupTypes: true,
      include: ['src'],
      compilerOptions: {
        declarationMap: true,
      },
      // Copy each entry's bundled .d.ts to a .d.cts for CommonJS consumers
      afterBuild: async () => {
        for (const name of entryNames) {
          try {
            const dtsPath = resolve(__dirname, `dist/types/${name}.d.ts`)
            const dctsPath = resolve(__dirname, `dist/types/${name}.d.cts`)
            const content = await fs.readFile(dtsPath, 'utf-8')
            await fs.writeFile(dctsPath, content)
            console.log(`Successfully created ${name}.d.cts file`)
          } catch (error) {
            console.error(`Error creating ${name}.d.cts file:`, error)
          }
        }
      },
    }),
  ],
})
