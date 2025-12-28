#!/usr/bin/env tsx
/**
 * Determines which E2E tests to run based on changed files.
 *
 * Usage:
 *   pnpm tsx scripts/select-e2e-tests.ts
 *   pnpm tsx scripts/select-e2e-tests.ts --base=origin/main
 *
 * Output:
 *   Space-separated list of test file patterns to run
 *   Example: "e2e/tests/auth/** e2e/tests/family/**"
 */

import { execSync } from "child_process";
import { minimatch } from "minimatch";
import { readFileSync } from "fs";
import { join } from "path";

interface TestMapping {
  mappings: Record<string, string[]>;
  alwaysRun: string[];
  fullRunTriggers: string[];
}

function getChangedFiles(base: string): string[] {
  try {
    const result = execSync(`git diff --name-only ${base}...HEAD`, {
      encoding: "utf-8",
    });
    return result.trim().split("\n").filter(Boolean);
  } catch {
    // Fallback to comparing with previous commit
    try {
      const result = execSync("git diff --name-only HEAD~1", {
        encoding: "utf-8",
      });
      return result.trim().split("\n").filter(Boolean);
    } catch {
      // No previous commit, run all tests
      return [];
    }
  }
}

function loadTestMapping(): TestMapping {
  const mappingPath = join(process.cwd(), "e2e", "test-mapping.json");
  const content = readFileSync(mappingPath, "utf-8");
  return JSON.parse(content);
}

function selectTests(changedFiles: string[], mapping: TestMapping): string[] {
  // Check for full run triggers first
  const needsFullRun = changedFiles.some((file) =>
    mapping.fullRunTriggers.some((pattern) => minimatch(file, pattern))
  );

  if (needsFullRun) {
    return ["e2e/tests/**/*.spec.ts"];
  }

  // Start with always-run tests
  const testsToRun = new Set<string>(mapping.alwaysRun);

  // Find matching tests for changed files
  for (const file of changedFiles) {
    for (const [pattern, tests] of Object.entries(mapping.mappings)) {
      if (minimatch(file, pattern)) {
        tests.forEach((test) => testsToRun.add(test));
      }
    }
  }

  // If only alwaysRun tests matched, run all tests (safety fallback)
  if (testsToRun.size === mapping.alwaysRun.length && changedFiles.length > 0) {
    console.error(
      "Warning: No test mappings matched changed files, running all tests"
    );
    return ["e2e/tests/**/*.spec.ts"];
  }

  return [...testsToRun];
}

// Main execution
const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith("--base="));
const base = baseArg ? baseArg.split("=")[1] : "origin/main";

const changedFiles = getChangedFiles(base);

if (changedFiles.length === 0) {
  // No changes detected, run all tests
  console.log("e2e/tests/**/*.spec.ts");
  process.exit(0);
}

const mapping = loadTestMapping();
const selectedTests = selectTests(changedFiles, mapping);

console.log(selectedTests.join(" "));
