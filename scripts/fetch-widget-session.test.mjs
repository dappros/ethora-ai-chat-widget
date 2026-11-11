import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWidgetSession } from '../src/utils/fetchWidgetSession.ts';

test('4xx responses are returned without retries', async () => {
  for (const status of [400, 404, 409, 422, 429]) {
    let calls = 0;
    const response = await fetchWidgetSession('https://example.test', {}, async () => {
      calls++;
      return new Response(null, { status });
    }, async () => { throw new Error('must not wait'); });
    assert.equal(response.status, status);
    assert.equal(calls, 1);
  }
});

test('5xx failures retry twice with delays and stop', async () => {
  let calls = 0;
  const delays = [];
  const response = await fetchWidgetSession('https://example.test', {}, async () => {
    calls++;
    return new Response(null, { status: 503 });
  }, async (ms) => { delays.push(ms); });
  assert.equal(response.status, 503);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test('transient network failure retries and stops on success', async () => {
  let calls = 0;
  const delays = [];
  const response = await fetchWidgetSession('https://example.test', {}, async () => {
    if (++calls === 1) throw new TypeError('network failure');
    return new Response(null, { status: 200 });
  }, async (ms) => { delays.push(ms); });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [1000]);
});
