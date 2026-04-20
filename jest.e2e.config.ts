export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: [
    "**/__tests__/e2e/**/*.e2e.test.ts",
    "**/__tests__/integration/**/*.integration.test.ts",
  ],
  testTimeout: 30000,
  maxWorkers: 1,
  // Bail on first failure to save API calls during integration tests
  bail: true,
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  // Display verbose output for integration tests
  verbose: true,
}
