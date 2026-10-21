#!/usr/bin/env node
// Checks what `npm publish` would put in the package, without publishing: runs
// `npm pack --dry-run` and verifies the list of files. Needs a built dist/.
//
//   node scripts/check-package.mjs
//
// The package must carry the readable bundle and the pdf.js files the bundle loads
// from pdfjs/ next to itself. Anything outside dist/ other than the usual metadata
// is a mistake (the `files` list in package.json is dist only).
import { spawnSync } from 'node:child_process';

const REQUIRED = [
  'package.json',
  'dist/ethora_assistant.js',
  'dist/pdfjs/pdf.min.mjs',
  'dist/pdfjs/pdf.worker.min.mjs',
];
const ALLOWED_OUTSIDE_DIST = new Set(['package.json', 'README.md', 'LICENSE.txt']);

// --ignore-scripts: the prepare script prints to stdout and would break the JSON.
const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (result.status !== 0) {
  console.error(result.stderr);
  console.error('check-package: npm pack --dry-run failed');
  process.exit(1);
}

let pack;
try {
  [pack] = JSON.parse(result.stdout);
} catch (err) {
  console.error(`check-package: cannot read the npm pack output: ${err.message}`);
  process.exit(1);
}

const files = pack.files.map((file) => file.path);
const problems = [];
for (const need of REQUIRED) {
  if (!files.includes(need)) problems.push(`missing from the package: ${need}`);
}
const stray = files.filter((file) => !file.startsWith('dist/') && !ALLOWED_OUTSIDE_DIST.has(file));
if (stray.length > 0) problems.push(`unexpected files in the package: ${stray.join(', ')}`);

console.log(`${pack.name}@${pack.version}: ${files.length} files, ${(pack.unpackedSize / 1048576).toFixed(1)} MB unpacked`);
if (problems.length > 0) {
  for (const problem of problems) console.error(`error: ${problem}`);
  process.exit(1);
}
console.log('check-package: ok');
