import { writeFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { config } from 'dotenv'
import fetch from 'node-fetch'

// Load environment variables from root and package .env files
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnv = resolve(__dirname, '../../../.env')
const packageEnv = resolve(__dirname, '../.env')
config({ path: rootEnv })
config({ path: packageEnv })

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const SPECS = {
  registry: {
    url: 'https://raw.githubusercontent.com/TxnLab/nfd-backend/main/internal/algo/teal/v3/NFDRegistry.arc56.json',
    outputPath: resolve(__dirname, '../src/contracts/NFDRegistry.arc56.json'),
  },
  instance: {
    url: 'https://raw.githubusercontent.com/TxnLab/nfd-backend/main/internal/algo/teal/v3/NFDInstance.arc56.json',
    outputPath: resolve(__dirname, '../src/contracts/NFDInstance.arc56.json'),
  },
}

async function fetchArc56Specs() {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is required')
  }

  console.log('Fetching ARC-56 specifications...')

  try {
    // Ensure contracts directory exists
    await mkdir(dirname(SPECS.registry.outputPath), { recursive: true })

    // Fetch and save each spec
    for (const [name, spec] of Object.entries(SPECS)) {
      console.log(`Fetching ${name} specification...`)
      const response = await fetch(spec.url, {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      })

      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${name} spec: ${response.status} ${response.statusText}`,
        )
      }

      const specContent = await response.text()
      await writeFile(spec.outputPath, specContent, 'utf-8')
      console.log(`${name} specification saved to ${spec.outputPath}`)
    }

    console.log('Successfully fetched all ARC-56 specifications')
  } catch (error) {
    console.error('Error fetching ARC-56 specifications:', error)
    process.exit(1)
  }
}

// Execute the script
fetchArc56Specs()
