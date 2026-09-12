/* global process, fetch, FormData, Blob, console */
// Uses only synthetic data. Creates one small case; keeps it for verification after restart.
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://localhost:8080';
async function request(path, init) {
  const response = await fetch(`${base}${path}`, init);
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response;
}
assert.equal((await (await request('/health')).json()).status, 'ok');
assert.equal((await (await request('/ready')).json()).status, 'ready');
assert.match(await (await request('/')).text(), /<div id="root"><\/div>/);
const config = await (await request('/api/config')).json();
assert.equal(config.aiMode, 'mock', 'Use smoke-vertex.mjs for real model verification.');
const claim = await (
  await request('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Synthetic deployment smoke test' }),
  })
).json();
const pdf = '%PDF-1.4\nSynthetic deployment smoke document\n%%EOF';
const body = new FormData();
body.append('file', new Blob([pdf], { type: 'application/pdf' }), 'synthetic-smoke.pdf');
const uploaded = await (
  await request(`/api/cases/${claim.id}/uploads?type=CLAIM_FORM`, { method: 'POST', body })
).json();
const doc = uploaded.documents[0];
assert.equal(
  await (await request(`/api/cases/${claim.id}/documents/${doc.id}/content`)).text(),
  pdf,
);
const processed = await (
  await request(`/api/cases/${claim.id}/process`, { method: 'POST' })
).json();
assert.equal(processed.status, 'NEEDS_INPUT');
assert.equal(processed.agentRuns.length, 6);
assert.ok(processed.agentRuns.every((run) => run.status === 'SUCCEEDED'));
const reviewed = await (
  await request(`/api/cases/${claim.id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'ESCALATE',
      reviewerId: 'smoke-tester',
      reason: 'Synthetic deployment verification',
    }),
  })
).json();
assert.equal(reviewed.reviews.length, 1);
assert.equal((await (await request(`/api/cases/${claim.id}/audit-events`)).json()).length, 17);
console.log(
  JSON.stringify(
    {
      status: 'PASS',
      caseId: claim.id,
      documentId: doc.id,
      storageUri: doc.storageUri,
      verifyAfterRestart: `${base}/api/cases/${claim.id}`,
    },
    null,
    2,
  ),
);
