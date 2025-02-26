import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './src/api/openapi3.yaml',
  output: {
    format: 'prettier',
    lint: 'eslint',
    path: './src/api',
  },
  plugins: ['@hey-api/client-fetch'],
})
