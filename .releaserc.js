export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  pkgRoot: 'packages/sdk',
  plugins: [
    '@semantic-release/commit-analyzer',
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'angular',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'refactor', section: 'Code Refactoring' },
            { type: 'perf', section: 'Performance Improvements' },
            { type: 'docs', section: 'Documentation', hidden: true },
            { type: 'style', section: 'Styles', hidden: true },
            { type: 'chore', section: 'Miscellaneous Chores', hidden: true },
            { type: 'test', section: 'Tests', hidden: true },
            { type: 'build', section: 'Build System', hidden: true },
            { type: 'ci', section: 'Continuous Integration', hidden: true },
          ],
        },
        writerOpts: {
          commitsSort: false,
          commitGroupsSort: (a, b) => {
            const order = [
              'Features',
              'Bug Fixes',
              'Code Refactoring',
              'Performance Improvements',
            ]
            const aIndex = order.indexOf(a.title)
            const bIndex = order.indexOf(b.title)
            // Put items not in the list at the end
            if (aIndex === -1 && bIndex === -1) return 0
            if (aIndex === -1) return 1
            if (bIndex === -1) return -1
            return aIndex - bIndex
          },
        },
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'packages/sdk/CHANGELOG.md',
      },
    ],
    '@semantic-release/npm',
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['packages/sdk/CHANGELOG.md', 'packages/sdk/package.json'],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
}
