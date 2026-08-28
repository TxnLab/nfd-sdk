import tseslint from 'typescript-eslint'
import baseConfig from '../../eslint.config.js'

export default tseslint.config(
  ...baseConfig,
  {
    // Source files
    files: ['src/**/*.ts'],
    ignores: ['src/api/*.gen.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        // Anchor the relative project path to this file. typescript-eslint
        // used to resolve it against process.cwd(), which happened to be this
        // package under `pnpm -r lint`; it now resolves against the workspace
        // root, where no tsconfig.json exists.
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
    },
  },
  {
    // Config files and scripts
    files: ['*.config.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
)
