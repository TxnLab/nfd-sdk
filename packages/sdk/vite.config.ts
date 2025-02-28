import { promises as fs } from 'fs'
import { resolve } from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'nfd-sdk',
    },
    outDir: 'dist',
    rollupOptions: {
      external: [
        'algosdk',
        '@algorandfoundation/algokit-utils',
        '@hey-api/client-fetch',
        'crypto-js',
      ],
      output: [
        {
          format: 'es',
          dir: 'dist/esm',
          entryFileNames: 'index.js',
          preserveModules: false,
          exports: 'named',
          // Split the large contract clients into a separate chunk
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
          entryFileNames: 'index.cjs',
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
      // Use afterBuild hook to copy .d.ts to .d.cts
      afterBuild: async () => {
        try {
          const dtsPath = resolve(__dirname, 'dist/types/index.d.ts')
          const dctsPath = resolve(__dirname, 'dist/types/index.d.cts')
          const content = await fs.readFile(dtsPath, 'utf-8')
          await fs.writeFile(dctsPath, content)
          console.log('Successfully created .d.cts file')
        } catch (error) {
          console.error('Error creating .d.cts file:', error)
        }
      },
    }),
  ],
})
