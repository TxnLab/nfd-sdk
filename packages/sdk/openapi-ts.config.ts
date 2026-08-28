import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './openapi3.yaml',
  output: {
    path: './src/api',
    // eslint is not in the list: the generated client is excluded from linting
    // (see eslint.config.js), so running it here only fails the generate step.
    postProcess: ['prettier'],
  },
  plugins: ['@hey-api/client-fetch'],
})
