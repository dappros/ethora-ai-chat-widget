#!/usr/bin/env node
// Checks the built widget bundle before it is released or handed to WordPress.
//
// WordPress.org requires human-readable JavaScript, so the bundle must not be
// minified, and it must not point at a source map that is not shipped.
//
//   node scripts/check-bundle.mjs [path]    default: dist/ethora_assistant.js
//
// Exits 1 on a problem. Non-ASCII characters are reported as a warning only: the
// widget is meant to be ASCII-only so it renders on pages that are not UTF-8,
// but a few lines still carry non-ASCII text today.
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'dist/ethora_assistant.js';

let text;
try {
  text = readFileSync(file, 'utf8');
} catch (err) {
  console.error(`check-bundle: cannot read ${file}: ${err.message}`);
  process.exit(1);
}

const lines = text.split('\n');
const averageLength = text.length / lines.length;
const nonAsciiLines = lines.filter((line) => /[^\x00-\x7F]/.test(line)).length;
const sizeMb = Buffer.byteLength(text) / (1024 * 1024);

const problems = [];
const warnings = [];

if (lines.length < 5000) {
  problems.push(`only ${lines.length} lines, the bundle looks minified`);
}
if (averageLength > 200) {
  problems.push(`average line length is ${Math.round(averageLength)}, the bundle looks minified`);
}
if (/\/\/# sourceMappingURL=/.test(text)) {
  problems.push('contains a sourceMappingURL comment, but no source map is shipped');
}
if (nonAsciiLines > 0) {
  warnings.push(`${nonAsciiLines} lines contain non-ASCII characters`);
}
if (sizeMb > 8) {
  warnings.push(`the bundle is ${sizeMb.toFixed(1)} MB`);
}

console.log(`${file}: ${lines.length} lines, average ${Math.round(averageLength)} chars, ${sizeMb.toFixed(1)} MB`);
for (const warning of warnings) console.log(`warning: ${warning}`);
if (problems.length > 0) {
  for (const problem of problems) console.error(`error: ${problem}`);
  process.exit(1);
}
console.log('check-bundle: ok');
