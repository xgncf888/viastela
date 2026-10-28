/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/core/**/*.test.ts',
    '<rootDir>/src/data/**/*.test.ts',
    '<rootDir>/src/features/**/*.test.ts',
    '<rootDir>/src/ui/**/*.test.ts',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false }],
  },
};
