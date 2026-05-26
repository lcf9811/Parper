#!/usr/bin/env node
/**
 * Test Runner: Runs all unit and integration tests
 *
 * Usage:
 *   node --no-node-snapshot --import tsx tests/runTests.ts          # Run all tests
 *   node --no-node-snapshot --import tsx tests/runTests.ts unit     # Run unit tests only
 *   node --no-node-snapshot --import tsx tests/runTests.ts e2e      # Run e2e tests only
 */

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { server as mockServer, PORT as MOCK_PORT } from './helpers/mockServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const mode = args[0] || 'all';

// Track overall results
let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;

async function runTestFile(relativePath: string) {
  const filePath = path.join(__dirname, relativePath);
  // On Windows, dynamic import needs file:// URLs
  const fileUrl = pathToFileURL(filePath).href;
  console.log(`\n📁 Running: ${relativePath}`);
  totalTests++;

  try {
    await import(fileUrl);
    console.log(`✅ Completed: ${relativePath}`);
  } catch (e: any) {
    console.log(`❌ Failed: ${relativePath}`);
    console.log(`   Error: ${e.message}`);
    totalFailed++;
  }
}

async function main() {
  // Start mock server
  await new Promise<void>((resolve) => {
    mockServer.listen(MOCK_PORT, () => {
      console.log(`\n🔌 Mock server started on http://127.0.0.1:${MOCK_PORT}`);
      resolve();
    });
  });

  try {
    if (mode === 'all' || mode === 'unit') {
      await runTestFile('unit/capabilityRegistry.test.ts');
      await runTestFile('unit/httpApi.test.ts');
      await runTestFile('unit/pythonRunner.test.ts');
    }

    if (mode === 'all' || mode === 'e2e') {
      await runTestFile('integration/e2e.test.ts');
    }
  } finally {
    // Stop mock server
    mockServer.close();
    console.log('\n🔌 Mock server stopped');
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Overall Results`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Test files run: ${totalTests}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`${'='.repeat(60)}\n`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
