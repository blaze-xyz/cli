export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/e2e/"],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/e2e/",
    "/__tests__/e2e/",
    "/cli/commands/",
  ],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
}
