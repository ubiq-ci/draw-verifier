import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalize, type DrawRecord } from '../src/canonical.js';
import { verifyLedger, type SignedEntry, type PublicKeys } from '../src/verify.js';

test('canonical encoding matches the engine golden vector', () => {
  const record: DrawRecord = {
    version: '2.0',
    seqNo: 0,
    drawId: 'draw-1',
    eventId: 'evt-1',
    drawName: 'Evening draw',
    scheduledAt: '2026-01-01T20:00:00Z',
    closingDate: '2026-01-01T19:45:00Z',
    gameSpec: {
      gameId: 'g1',
      draws: [
        { label: 'winning', pool: { min: 1, max: 90 }, count: 5, withReplacement: false, ordered: false },
        { label: 'machine', pool: { min: 1, max: 90 }, count: 5, withReplacement: false, ordered: false },
      ],
      distinctAcross: [['winning', 'machine']],
    },
    result: { winning: [1, 2, 3, 4, 5], machine: [6, 7, 8, 9, 10] },
    generatedAt: '2026-01-01T00:00:00Z',
    nonce: 'nonce123',
    prevHash: 'sha256:abc',
  };
  const expected = '{"closingDate":"2026-01-01T19:45:00Z","drawId":"draw-1","drawName":"Evening draw","eventId":"evt-1","gameSpec":{"distinctAcross":[["winning","machine"]],"draws":[{"count":5,"label":"winning","ordered":false,"pool":{"max":90,"min":1},"withReplacement":false},{"count":5,"label":"machine","ordered":false,"pool":{"max":90,"min":1},"withReplacement":false}],"gameId":"g1"},"generatedAt":"2026-01-01T00:00:00Z","nonce":"nonce123","prevHash":"sha256:abc","result":{"machine":[6,7,8,9,10],"winning":[1,2,3,4,5]},"seqNo":0,"version":"2.0"}';
  assert.equal(canonicalize(record), expected);
});

function loadFixtures(): { entries: SignedEntry[]; keys: PublicKeys } {
  const entries = readFileSync(new URL('../../test/fixtures/ledger.jsonl', import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as SignedEntry);
  const keys = JSON.parse(readFileSync(new URL('../../test/fixtures/keys.json', import.meta.url), 'utf8')) as PublicKeys;
  return { entries, keys };
}

test('verifies a valid signed ledger', async () => {
  const { entries, keys } = loadFixtures();
  const result = await verifyLedger(entries, keys);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(result.count, 3);
});

test('rejects a tampered number', async () => {
  const { entries, keys } = loadFixtures();
  const n = entries[0].record.result.winning[0];
  entries[0].record.result.winning[0] = (n % 90) + 1;
  const result = await verifyLedger(entries, keys);
  assert.equal(result.ok, false);
});

test('rejects a broken chain', async () => {
  const { entries, keys } = loadFixtures();
  entries[1].record.prevHash = 'sha256:' + '0'.repeat(64);
  const result = await verifyLedger(entries, keys);
  assert.equal(result.ok, false);
});

test('rejects an unknown key', async () => {
  const { entries } = loadFixtures();
  const result = await verifyLedger(entries, {});
  assert.equal(result.ok, false);
});
