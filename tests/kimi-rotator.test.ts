import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test"
import { homedir } from "os"
import { join } from "path"

// Mock auth.json path for testing
const TEST_AUTH_PATH = join(homedir(), ".local", "share", "opencode", "auth.json")

describe("KimiRotatorPlugin", () => {
  let originalAuthContent: string | null = null

  beforeEach(async () => {
    // Backup original auth.json if it exists
    try {
      const file = Bun.file(TEST_AUTH_PATH)
      if (await file.exists()) {
        originalAuthContent = await file.text()
      }
    } catch {
      originalAuthContent = null
    }
  })

  afterEach(async () => {
    // Restore original auth.json
    if (originalAuthContent) {
      await Bun.write(TEST_AUTH_PATH, originalAuthContent)
    }
  })

  test("auth.json exists and is readable", async () => {
    const file = Bun.file(TEST_AUTH_PATH)
    const exists = await file.exists()
    expect(exists).toBe(true)
    
    if (exists) {
      const content = await file.json()
      expect(content).toBeDefined()
      expect(typeof content).toBe("object")
    }
  })

  test("auth.json contains kimi-for-coding provider", async () => {
    const file = Bun.file(TEST_AUTH_PATH)
    const content = await file.json()
    
    // Check if kimi-for-coding exists (it should based on user's config)
    expect(content["kimi-for-coding"]).toBeDefined()
    expect(content["kimi-for-coding"].type).toBe("api")
    expect(content["kimi-for-coding"].key).toBeDefined()
  })

  test("can write and read back from auth.json", async () => {
    const file = Bun.file(TEST_AUTH_PATH)
    const originalContent = await file.json()
    
    // Create a test modification
    const testContent = { ...originalContent }
    testContent["_test_marker"] = { test: true }
    
    // Write
    await Bun.write(TEST_AUTH_PATH, JSON.stringify(testContent, null, 2))
    
    // Read back
    const readBack = await Bun.file(TEST_AUTH_PATH).json()
    expect(readBack["_test_marker"]).toBeDefined()
    expect(readBack["_test_marker"].test).toBe(true)
    
    // Clean up test marker
    delete readBack["_test_marker"]
    await Bun.write(TEST_AUTH_PATH, JSON.stringify(readBack, null, 2))
  })
})
