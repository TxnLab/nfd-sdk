import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFile } from 'fs/promises'
import fetch from 'node-fetch'

// Load environment variables from root and package .env files
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnv = resolve(__dirname, '../../../.env')
const packageEnv = resolve(__dirname, '../.env')
config({ path: rootEnv })
config({ path: packageEnv })

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const SPEC_URL =
  'https://raw.githubusercontent.com/TxnLab/nfd-backend/main/goasvcs/pubapi/gen/http/openapi3.yaml'
const OUTPUT_PATH = resolve(__dirname, '../src/openapi3.yaml')

async function fetchOpenApiSpec() {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required')
  }

  console.log('Fetching OpenAPI specification...')

  try {
    const response = await fetch(SPEC_URL, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3.raw',
      },
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`,
      )
    }

    const spec = await response.text()
    await writeFile(OUTPUT_PATH, spec, 'utf-8')

    console.log(`OpenAPI specification saved to ${OUTPUT_PATH}`)
  } catch (error) {
    console.error('Error fetching OpenAPI specification:', error)
    process.exit(1)
  }
}

// Execute the script
fetchOpenApiSpec()
