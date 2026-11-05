/** Research-only: runs the EXISTING production test suites with the proposed masked RNG substituted. */
module.exports = {
  rootDir: '..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/tests/**/*.test.ts'],
  moduleNameMapper: { '^(\\.\\./)+(shared/)?rng/ProvablyFairRNG$': '<rootDir>/research/patches/ProvablyFairRNG.masked.ts', '^\\.\\./shared/rng/ProvablyFairRNG$': '<rootDir>/research/patches/ProvablyFairRNG.masked.ts', '^\\.\\./rng/ProvablyFairRNG$': '<rootDir>/research/patches/ProvablyFairRNG.masked.ts' },
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json', diagnostics: false }] },
};
