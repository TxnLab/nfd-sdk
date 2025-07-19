import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './src/openapi3.yaml',
  output: {
    format: 'prettier',
    lint: 'eslint',
    path: './src',
  },
  plugins: ['@hey-api/client-fetch'],
})
