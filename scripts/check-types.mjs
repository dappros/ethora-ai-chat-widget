#!/usr/bin/env node
// Type check with a ratchet. `tsc` reports errors today that come from
// @ethora/chat-component subpath imports the published package does not map for
// types (see docs/WORKFLOW.md), so a clean run is not possible yet. This script
// runs tsc and compares the number of errors with scripts/typecheck-baseline.json:
//
//   - more errors than the baseline: fail (a new type error was introduced)
//   - fewer errors than the baseline: pass, and ask to lower the baseline
//   - equal: pass
//
//   node scripts/check-types.mjs              check
//   node scripts/check-types.mjs --update     write the current count as the baseline
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASELINE_FILE = new URL('./typecheck-baseline.json', import.meta.url);
const update = process.argv.includes('--update');

const result = spawnSync('npx', ['--no-install', 'tsc', '-p', 'tsconfig.app.json', '--noEmit'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (result.error) {
  console.error(`check-types: cannot run tsc: ${result.error.message}`);
  process.exit(1);
}

const output = `${result.stdout}${result.stderr}`;
const errors = output.split('\n').filter((line) => /: error TS\d+:/.test(line));
const count = errors.length;

// tsc failed without printing a single error line: it did not run properly.
if (result.status !== 0 && count === 0) {
  console.error(output.trim());
  console.error('check-types: tsc failed without reporting type errors');
  process.exit(1);
}

if (update) {
  writeFileSync(BASELINE_FILE, `${JSON.stringify({ errors: count }, null, 2)}\n`);
  console.log(`check-types: baseline set to ${count}`);
  process.exit(0);
}

const { errors: baseline } = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
console.log(`check-types: ${count} errors, baseline ${baseline}`);
if (count > baseline) {
  for (const line of errors) console.error(line);
  console.error(`check-types: ${count - baseline} new type error(s). Fix them, the baseline only goes down.`);
  process.exit(1);
}
if (count < baseline) {
  console.log(`check-types: fewer errors than the baseline. Run "node scripts/check-types.mjs --update" and commit the new baseline.`);
}
