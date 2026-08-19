#!/usr/bin/env node
// Drift guard for the embed contract.
//
// attributes.ts only earns its keep while it matches the code: the admin app
// renders its embed snippet from it. It had already drifted once - the admin
// offered four optional attributes while the widget read over thirty - so
// this scans the real sources and fails on a mismatch in either direction.
//
// A plain script, not a test-runner case, because this package has no test
// runner and adding one for a single check is not worth the dependency.
//
//   npm run check:attributes

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// Names declared in the manifest. Parsed from source rather than imported so
// the check needs no build step and no TypeScript loader.
const manifest = read('src/widget/attributes.ts');
const declared = new Set(
  [...manifest.matchAll(/name:\s*'(data-[a-z0-9-]+)'/g)].map((m) => m[1])
);

// Names the code actually asks for.
const readByCode = new Set();
for (const file of ['src/widget/appearance.ts', 'src/main.tsx']) {
  for (const m of read(file).matchAll(/['"`](data-[a-z0-9-]+)['"`]/g)) {
    readByCode.add(m[1]);
  }
}

const problems = [];

const undocumented = [...readByCode].filter((a) => !declared.has(a)).sort();
if (undocumented.length) {
  problems.push(
    `Read by the code but missing from WIDGET_ATTRIBUTES, so the admin's ` +
      `embed snippet will never offer them:\n    ${undocumented.join('\n    ')}`
  );
}

const dead = [...declared].filter((a) => !readByCode.has(a)).sort();
if (dead.length) {
  problems.push(
    `Declared in WIDGET_ATTRIBUTES but nothing reads them, so the admin ` +
      `would document attributes that silently do nothing:\n    ${dead.join('\n    ')}`
  );
}

const names = [...manifest.matchAll(/name:\s*'(data-[a-z0-9-]+)'/g)].map((m) => m[1]);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length) problems.push(`Duplicate entries: ${[...new Set(dupes)].join(', ')}`);

for (const m of manifest.matchAll(/deprecatedAliasFor:\s*'(data-[a-z0-9-]+)'/g)) {
  if (!declared.has(m[1])) problems.push(`Alias points at unknown attribute: ${m[1]}`);
}

const required = [...manifest.matchAll(/name:\s*'(data-[a-z0-9-]+)',\s*\n\s*group:[^}]*?required:\s*true/g)].map((m) => m[1]);
if (required.length !== 1 || required[0] !== 'data-app-id') {
  problems.push(`Expected exactly one required attribute (data-app-id), got: ${required.join(', ') || 'none'}`);
}

if (problems.length) {
  console.error('\nEmbed attribute contract is out of sync:\n');
  problems.forEach((p) => console.error('  - ' + p + '\n'));
  process.exit(1);
}

console.log(`Embed attribute contract OK: ${declared.size} attributes, all read by the code.`);
