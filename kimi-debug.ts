// Debug script for Kimi Coding API via Proxy
// Usage:
//   1. Start the proxy: bun run kimi-proxy.ts
//   2. Run this script: bun run kimi-debug.ts
//
// Tests both direct API and proxy to verify configuration

const API_KEY =
  "sk-kimi-Rqsr9OjMKB8yrmvHPfdfkvRetR81bZdpi7hZSYttXxUcM0D5JBli109yQ5MgMH8k";
const PROXY_URL = "http://localhost:8083/v1/chat/completions";
const DIRECT_URL = "https://api.kimi.com/coding/v1/chat/completions";

// Test different model IDs that might be used
const TEST_MODELS = ["kimi-k2.5", "kimi-k2-thinking", "kimi-for-coding"];

async function testEndpoint(
  name: string,
  url: string,
  apiKey: string,
  modelId = "kimi-k2.5",
) {
  console.log(`\n========== Testing: ${name} ==========`);
  console.log(`URL: ${url}`);
  console.log(`Model: ${modelId}`);

  const body = {
    model: modelId,
    stream: false,
    messages: [
      { role: "user", content: "Say 'Hello from Kimi' and nothing else." },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "claude-code/2.0",
      },
      body: JSON.stringify(body),
    });

    console.log(`Status: ${res.status} ${res.statusText}`);

    // Log response headers
    console.log("\nResponse Headers:");
    res.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    const json = await res.json().catch((err) => {
      console.error("Failed to parse JSON:", err);
      return null;
    });

    if (json) {
      console.log("\nResponse Body:");
      console.log(JSON.stringify(json, null, 2));

      if (json.model) {
        console.log(`\n✓ Model reported: ${json.model}`);
      }

      if (json.choices && json.choices[0]) {
        const content = json.choices[0].message?.content;
        console.log(`\n✓ Response content: ${content}`);
      }

      if (json.error) {
        console.error(`\n✗ API Error: ${JSON.stringify(json.error)}`);
      }
    }

    return res.ok;
  } catch (error) {
    console.error(`\n✗ Request failed: ${error}`);
    return false;
  }
}

async function main() {
  console.log("========================================");
  console.log("Kimi Coding API Debug Tool");
  console.log("========================================");

  if (!API_KEY || API_KEY.includes("REPLACE_WITH")) {
    console.error("\n✗ Please set a valid API_KEY in the script");
    process.exit(1);
  }

  // Test 1: Direct API connection with different models
  console.log("\n>>> Testing Direct API with different models...");
  for (const model of TEST_MODELS) {
    await testEndpoint(`Direct API (${model})`, DIRECT_URL, API_KEY, model);
  }

  // Test 2: Via Proxy with different models
  console.log("\n>>> Testing Proxy with different models...");
  let proxyOk = false;
  for (const model of TEST_MODELS) {
    const ok = await testEndpoint(
      `Via Proxy (${model})`,
      PROXY_URL,
      "dummy-key",
      model,
    );
    if (ok) proxyOk = true;
  }

  // Summary
  console.log("\n========================================");
  console.log("Summary:");
  console.log("========================================");
  console.log(`Proxy:  ${proxyOk ? "✓ OK" : "✗ FAILED"}`);

  if (!proxyOk) {
    console.log("\n⚠ Proxy is not working correctly. Check:");
    console.log("  1. Is the proxy running? (bun run kimi-proxy.ts)");
    console.log("  2. Is the proxy on port 8083?");
    console.log("  3. Check proxy logs for errors");
  } else {
    console.log("\n✓ All tests passed! Your setup should work with OpenCode.");
    console.log("\nNext steps:");
    console.log("  1. Make sure proxy is running: bun run kimi-proxy.ts");
    console.log("  2. Start OpenCode");
    console.log("  3. Select model: kimi-rotated/kimi-k2.5");
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
