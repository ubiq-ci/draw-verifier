#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { verifyLedger, type SignedEntry, type PublicKeys } from './verify.js';

async function main(): Promise<void> {
  const [ledgerPath, keysPath] = process.argv.slice(2);
  if (!ledgerPath || !keysPath) {
    console.error('usage: draw-verifier <ledger.jsonl> <keys.json>');
    process.exit(2);
  }

  const entries = readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as SignedEntry);
  const keys = JSON.parse(readFileSync(keysPath, 'utf8')) as PublicKeys;

  const result = await verifyLedger(entries, keys);
  if (result.ok) {
    console.log(`PASS: ${result.count} entries verified (signatures, hashes, chain).`);
    process.exit(0);
  }
  console.error(`FAIL: ${result.errors.length} problem(s):`);
  for (const e of result.errors) console.error('  - ' + e);
  process.exit(1);
}

main();
