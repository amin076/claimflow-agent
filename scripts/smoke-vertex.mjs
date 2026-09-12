/* global process, fetch, FormData, Blob, console */
// Exactly one model request per invocation. Synthetic PDFs are built in memory.
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
const base = process.argv[2] || 'http://localhost:8081';
const expectedMode = process.argv.includes('--mock') ? 'mock' : 'vertex';
async function request(path, init) {
  const response = await fetch(`${base}${path}`, init);
  assert.ok(
    response.ok,
    `${path}: HTTP ${response.status} ${response.ok ? '' : await response.text()}`,
  );
  return response;
}
const config = await (await request('/api/config')).json();
assert.equal(config.aiMode, expectedMode, 'Check deployment mode before running this test.');
const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const claim = await (
  await request('/api/cases', json('POST', { title: 'Synthetic phases 6-8 acceptance test' }))
).json();
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const page = pdf.addPage([595, 842]);
const lines = [
  'SYNTHETIC TEST - NOT A REAL INSURANCE CLAIM',
  'Claimant full name: Maya Rivera',
  'Incident date: 2026-09-10',
  'Incident address: 12 Synthetic Street, Testville',
  'Vehicle registration: SYN-482',
  'Damage description: Rear bumper dent',
  'Estimated damage amount: 1250.00',
];
lines.forEach((line, index) => page.drawText(line, { x: 40, y: 780 - index * 35, font, size: 12 }));
const body = new FormData();
body.append(
  'file',
  new Blob([await pdf.save()], { type: 'application/pdf' }),
  'synthetic-maya-claim.pdf',
);
const uploaded = await (
  await request(`/api/cases/${claim.id}/uploads?type=CLAIM_FORM`, { method: 'POST', body })
).json();
let result = await (await request(`/api/cases/${claim.id}/process`, { method: 'POST' })).json();
console.log(
  JSON.stringify(
    {
      caseId: claim.id,
      model: config.model,
      status: result.status,
      runs: result.agentRuns.map((run) => ({
        agent: run.agent,
        status: run.status,
        totalTokens: run.totalTokens,
        errorSummary: run.errorSummary,
      })),
    },
    null,
    2,
  ),
);
assert.equal(result.agentRuns.length, 6);
assert.ok(
  result.agentRuns.every((run) => run.status === 'SUCCEEDED'),
  'Workflow failed; inspect the case. No automatic retry.',
);
if (expectedMode === 'vertex') {
  const expected = {
    'claimant.fullName': 'Maya Rivera',
    'incident.date': '2026-09-10',
    'incident.address': '12 Synthetic Street, Testville',
    'vehicle.registration': 'SYN-482',
    'damage.description': 'Rear bumper dent',
    'damage.estimatedAmount': '1250.00',
  };
  for (const field of result.fields) {
    assert.ok(field.name in expected, `Unexpected field ${field.name}`);
    if (field.name === 'damage.estimatedAmount') assert.equal(Number(field.value), 1250);
    else
      assert.equal(
        String(field.value).trim().toLowerCase(),
        expected[field.name].toLowerCase(),
        `Fixture mismatch: ${field.name}`,
      );
    for (const evidence of field.evidence)
      assert.ok(
        lines.join(' ').toLowerCase().includes(evidence.excerpt.trim().toLowerCase()),
        'Evidence excerpt is not present in the source fixture',
      );
  }

  assert.equal(
    result.fields.find((field) => field.name === 'claimant.fullName')?.value,
    'Maya Rivera',
  );
  assert.equal(
    result.fields.find((field) => field.name === 'vehicle.registration')?.value,
    'SYN-482',
  );
  assert.equal(result.fields.find((field) => field.name === 'incident.date')?.value, '2026-09-10');
  assert.ok(
    result.fields.every((field) =>
      field.evidence.every(
        (item) => item.documentId === uploaded.documents[0].id && item.page === 1 && item.excerpt,
      ),
    ),
  );
  for (const field of result.fields) {
    result = await (
      await request(
        `/api/cases/${claim.id}/review`,
        json('PATCH', {
          reviewerId: 'synthetic-smoke-tester',
          action: 'ACCEPT',
          fieldName: field.name,
          reason:
            'Synthetic test harness checked the generated source fixture; not a real user review.',
        }),
      )
    ).json();
  }
  assert.equal(
    result.status,
    'READY',
    'Deterministic rules still report an issue; inspect the case.',
  );
  result = await (
    await request(
      `/api/cases/${claim.id}/review`,
      json('PATCH', {
        reviewerId: 'synthetic-smoke-tester',
        action: 'CORRECT',
        fieldName: 'incident.date',
        correctedValue: '2999-01-01',
        reason: 'Synthetic future-date rejection test',
      }),
    )
  ).json();
  assert.notEqual(result.status, 'READY');
  result = await (
    await request(
      `/api/cases/${claim.id}/review`,
      json('PATCH', {
        reviewerId: 'synthetic-smoke-tester',
        action: 'CORRECT',
        fieldName: 'incident.date',
        correctedValue: '2026-09-10',
        reason: 'Restore fixture-supported date',
      }),
    )
  ).json();
  assert.equal(result.status, 'READY');
}
console.log(
  JSON.stringify(
    {
      status: 'PASS',
      verification: expectedMode === 'vertex' ? 'LIVE_VERTEX_ADK_REVIEW' : 'MOCK_ADK_ONLY',
      caseId: claim.id,
      finalStatus: result.status,
      auditEvents: result.auditEvents.length,
    },
    null,
    2,
  ),
);
