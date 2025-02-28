import fs from 'fs'

// Files to process
const files = [
  'src/contracts/NFDRegistryClient.ts',
  'src/contracts/NFDInstanceClient.ts',
]

// Process each file
files.forEach((filePath) => {
  console.log(`Processing ${filePath}...`)

  // Read the file content
  const content = fs.readFileSync(filePath, 'utf8')

  // Replace the import equals syntax with type alias
  const modifiedContent = content.replace(
    /import\s+SimulateResponse\s+=\s+modelsv2\.SimulateResponse/g,
    'type SimulateResponse = modelsv2.SimulateResponse',
  )

  // Write the modified content back to the file
  fs.writeFileSync(filePath, modifiedContent, 'utf8')

  console.log(`Fixed ${filePath}`)
})

console.log('All files processed successfully.')
