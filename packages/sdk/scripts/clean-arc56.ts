import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import type { JsonValue } from 'type-fest'

const contractsDir = join(process.cwd(), 'src', 'contracts')
const minimalDir = join(contractsDir, 'minimal')

// Create the minimal directory if it doesn't exist
if (!existsSync(minimalDir)) {
  mkdirSync(minimalDir, { recursive: true })
}

const files = [
  {
    source: 'NFDInstance.arc56.json',
    target: 'NFDInstance.arc56.json',
  },
  {
    source: 'NFDRegistry.arc56.json',
    target: 'NFDRegistry.arc56.json',
  },
]

interface SourceInfoItem {
  errorMessage?: string
  teal?: number
  source?: string
  pc?: number[]
  [key: string]: JsonValue | undefined
}

interface ApprovalSourceInfo {
  sourceInfo: SourceInfoItem[]
  [key: string]: JsonValue | SourceInfoItem[] | undefined
}

interface Arc56Json {
  source?: {
    approval?: { bytecode: string }
    clear?: { bytecode: string }
  }
  sourceInfo?: {
    approval?: ApprovalSourceInfo
    clear?: ApprovalSourceInfo
    [key: string]: ApprovalSourceInfo | undefined
  }
  [key: string]:
    | JsonValue
    | { [key: string]: ApprovalSourceInfo | undefined }
    | { approval?: { bytecode: string }; clear?: { bytecode: string } }
    | undefined
}

files.forEach(({ source, target }) => {
  const sourceFilePath = join(contractsDir, source)
  const targetFilePath = join(minimalDir, target)

  // Read and parse the JSON file
  const content = JSON.parse(readFileSync(sourceFilePath, 'utf-8')) as Arc56Json

  // Remove the top-level source property
  delete content.source

  // If sourceInfo exists, filter it
  if (content.sourceInfo) {
    // Handle approval sourceInfo
    if (content.sourceInfo.approval?.sourceInfo) {
      content.sourceInfo.approval.sourceInfo =
        content.sourceInfo.approval.sourceInfo.filter(
          (info): info is SourceInfoItem =>
            info && typeof info === 'object' && 'errorMessage' in info,
        )
    }

    // Handle clear sourceInfo if it exists
    if (content.sourceInfo.clear?.sourceInfo) {
      content.sourceInfo.clear.sourceInfo =
        content.sourceInfo.clear.sourceInfo.filter(
          (info): info is SourceInfoItem =>
            info && typeof info === 'object' && 'errorMessage' in info,
        )
    }
  }

  // Write the modified content to the target file
  writeFileSync(targetFilePath, JSON.stringify(content, null, 2))

  const originalSize = readFileSync(sourceFilePath).length
  const newSize = readFileSync(targetFilePath).length
  const reduction = (((originalSize - newSize) / originalSize) * 100).toFixed(1)

  console.log(
    `Created ${join('minimal', target)}: Size reduced by ${reduction}% from original`,
  )
})

console.log('Finished creating minimal ARC56 files')
