/**
 * Test utilities for capability tests
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');
export const SKILLS_DIR = path.resolve(FIXTURES_DIR, 'skills');
export const SCRIPTS_DIR = path.resolve(FIXTURES_DIR, 'scripts');

/**
 * Simple assertion helper (since we don't have a test framework installed)
 */
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
  }
}

function assertContains(str: string, substring: string, message: string) {
  if (!str.includes(substring)) {
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected string to contain: "${substring}"\n  Actual: "${str}"`);
  }
}

async function assertRejects(fn: () => Promise<any>, message: string) {
  try {
    await fn();
    throw new Error(`ASSERTION FAILED: ${message}\n  Expected function to reject, but it resolved`);
  } catch (e: any) {
    if (e.message.startsWith('ASSERTION FAILED')) {
      throw e;
    }
    // Expected rejection
  }
}

export { assert, assertEqual, assertContains, assertRejects };

/**
 * Test runner: runs a set of test functions and reports results
 */
interface TestFn {
  name: string;
  fn: () => Promise<void> | void;
}

export async function runTests(suiteName: string, tests: TestFn[]) {
  let passed = 0;
  let failed = 0;
  let total = tests.length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${suiteName}`);
  console.log(`${'='.repeat(60)}`);

  for (const test of tests) {
    process.stdout.write(`  ${test.name}... `);
    try {
      await test.fn();
      console.log('PASS');
      passed++;
    } catch (e: any) {
      console.log('FAIL');
      console.log(`    Error: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n  Results: ${passed}/${total} passed, ${failed} failed`);
  console.log(`${'='.repeat(60)}\n`);

  return { passed, failed, total };
}
