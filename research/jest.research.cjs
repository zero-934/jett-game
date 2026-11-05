/** Research-only Jest config: probes and characterization tests. Not part of `npm test`. */
module.exports = {
  rootDir: '..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/research/**/*.probe.ts', '<rootDir>/research/**/*.char.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/research/tsconfig.research.json', diagnostics: { warnOnly: true } }] },
};
