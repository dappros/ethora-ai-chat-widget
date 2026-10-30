import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

async function setup(fetch) {
  const result = await build({ entryPoints: ['src/widget/storedAppearance.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
  const values = new Map();
  const localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, window: { localStorage }, fetch, AbortController, setTimeout, clearTimeout });
  return module.exports;
}

test('cached appearance is scoped to app and API and survives a failed refresh', async () => {
  const a = await setup(async () => ({ ok: false }));
  a.cacheAppearance('app', 'https://api.example', { 'data-launcher-icon': 'https://cdn.example/icon.png' });
  assert.equal(a.readCachedAppearance('app', 'https://api.example')['data-launcher-icon'], 'https://cdn.example/icon.png');
  assert.equal(Object.keys(a.readCachedAppearance('other', 'https://api.example')).length, 0);
  assert.equal(Object.keys(a.readCachedAppearance('app', 'https://other.example')).length, 0);
  assert.equal(await a.fetchStoredAppearance({ appId: 'app', apiBase: 'https://api.example' }), null);
  assert.equal(a.readCachedAppearance('app', 'https://api.example')['data-launcher-icon'], 'https://cdn.example/icon.png');
});
