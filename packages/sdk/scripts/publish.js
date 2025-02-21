import { publish } from '@tanstack/config/publish'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(__dirname, '..')
const rootDir = resolve(pkgRoot, '..', '..')

const config = {
  // Single package configuration
  packages: [pkgRoot],
  // Default branch configuration
  branchConfigs: {
    main: {
      prerelease: false,
    },
    next: {
      prerelease: true,
    },
    beta: {
      prerelease: true,
    },
    alpha: {
      prerelease: true,
    },
  },
  rootDir,
}

publish({
  ...config,
  branch: process.env.BRANCH,
  tag: process.env.TAG,
  ghToken: process.env.GH_TOKEN,
})
  .then(() => {
    console.log('Successfully published package!')
  })
  .catch((error) => {
    console.error('Failed to publish package:', error)
    process.exit(1)
  })
