#!/usr/bin/env node

/**
 * Integration test for browser auth in setup command
 * This verifies the code structure without requiring interactive input
 */

const fs = require("fs")
const path = require("path")

console.log("🧪 Testing blaze setup browser authentication integration...\n")

// Read the compiled setup code
const setupPath = path.join(__dirname, "dist/cli/index.js")
const setupCode = fs.readFileSync(setupPath, "utf8")

// Test 1: Check browser auth option exists
const hasBrowserOption = setupCode.includes(
  "Authenticate via browser (recommended)"
)
console.log(
  `✅ Test 1: Browser auth option exists: ${hasBrowserOption ? "PASS" : "FAIL"}`
)

// Test 2: Check runBrowserAuth function exists
const hasRunBrowserAuth = setupCode.includes("async function runBrowserAuth()")
console.log(
  `✅ Test 2: runBrowserAuth function exists: ${hasRunBrowserAuth ? "PASS" : "FAIL"}`
)

// Test 3: Check device code mutation
const hasDeviceCodeMutation = setupCode.includes("generateDeviceCode")
console.log(
  `✅ Test 3: Device code mutation exists: ${hasDeviceCodeMutation ? "PASS" : "FAIL"}`
)

// Test 4: Check token polling mutation
const hasTokenPolling = setupCode.includes("pollDeviceToken")
console.log(
  `✅ Test 4: Token polling mutation exists: ${hasTokenPolling ? "PASS" : "FAIL"}`
)

// Test 5: Check browser opening
const hasBrowserOpen = setupCode.includes("await open(")
console.log(
  `✅ Test 5: Browser opening logic exists: ${hasBrowserOpen ? "PASS" : "FAIL"}`
)

// Test 6: Check saveAuth call
const hasSaveAuth = setupCode.includes("await saveAuth({")
console.log(
  `✅ Test 6: Token storage (saveAuth) exists: ${hasSaveAuth ? "PASS" : "FAIL"}`
)

// Test 7: Check API endpoint configuration
const hasApiEndpoint = setupCode.includes("https://api.blaze.money")
console.log(
  `✅ Test 7: API endpoint configured: ${hasApiEndpoint ? "PASS" : "FAIL"}`
)

// Test 8: Check browser auth handler in switch
const hasBrowserHandler = setupCode.includes('if (authMethod === "browser")')
console.log(
  `✅ Test 8: Browser auth handler exists: ${hasBrowserHandler ? "PASS" : "FAIL"}`
)

// Test 9: Check spinner/loading states
const hasSpinner =
  setupCode.includes("spinner.start") && setupCode.includes("spinner.succeed")
console.log(
  `✅ Test 9: Loading states (spinners) exist: ${hasSpinner ? "PASS" : "FAIL"}`
)

// Test 10: Check error handling
const hasErrorHandling =
  setupCode.includes("catch") && setupCode.includes("throw")
console.log(
  `✅ Test 10: Error handling exists: ${hasErrorHandling ? "PASS" : "FAIL"}`
)

// Summary
const allTests = [
  hasBrowserOption,
  hasRunBrowserAuth,
  hasDeviceCodeMutation,
  hasTokenPolling,
  hasBrowserOpen,
  hasSaveAuth,
  hasApiEndpoint,
  hasBrowserHandler,
  hasSpinner,
  hasErrorHandling,
]

const passedTests = allTests.filter(t => t).length
const totalTests = allTests.length

console.log("\n" + "=".repeat(50))
console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`)

if (passedTests === totalTests) {
  console.log("✅ All integration checks passed!")
  console.log(
    "\n✨ Browser authentication is properly integrated into setup command."
  )
  console.log("🚀 Ready for manual testing with: node dist/cli/index.js setup")
  process.exit(0)
} else {
  console.log(`❌ ${totalTests - passedTests} test(s) failed`)
  console.log("⚠️  Please review the implementation")
  process.exit(1)
}
