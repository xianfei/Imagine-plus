module.exports = {
  // verbose: true,
  transform: {
    '.(ts|tsx)': '<rootDir>/node_modules/ts-jest'
  },
  testRegex: '/modules/__tests__/.*\\.test\\.(ts|tsx)$',
  modulePathIgnorePatterns: ['<rootDir>/lib'],
  moduleNameMapper: {
    // @tauri-apps/api is ESM-only; tests exercise the Electron path
    '^@tauri-apps/api/.*$': '<rootDir>/modules/__tests__/__stubs__/tauri-api.ts',
  },
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
  ]
}
