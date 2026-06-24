# draw-verifier

An independent verifier for signed lottery draw ledgers. It checks, for a
published ledger, that every draw is authentic and that the sequence has not
been altered:

- each entry's signature verifies against the published public key (ECDSA P-256),
- each stored hash matches the recomputed canonical hash of the record,
- the entries form an unbroken hash chain (linked `prevHash`, contiguous
  `seqNo`, no repeated draw id).

It has no cryptographic dependencies: it uses the Web Crypto API, so the core
runs both in Node and in the browser.

## Install

```
npm install
npm run build
```

## Use as a CLI

```
node dist/src/cli.js <ledger.jsonl> <keys.json>
```

- `ledger.jsonl`: one published entry per line.
- `keys.json`: a map of key id to base64 public key (X.509 SubjectPublicKeyInfo).

Exit code 0 and `PASS` if everything verifies, 1 and a list of problems otherwise.

## Use as a library

```ts
import { verifyLedger } from '@ubiq-ci/draw-verifier';

const result = await verifyLedger(entries, keys);
if (!result.ok) console.error(result.errors);
```

## Published format

Each entry:

```json
{
  "record": { "version": "1.0", "seqNo": 0, "drawId": "...", "gameSpec": { }, "result": { }, "timestamp": "...", "nonce": "...", "prevHash": "sha256:..." },
  "entryHash": "sha256:...",
  "keyId": "...",
  "signature": "<base64 DER ECDSA>"
}
```

The record is canonicalized with the JSON Canonicalization Scheme (RFC 8785)
before hashing and signing; the verifier recomputes that canonical form itself,
so it checks the actual draw numbers rather than trusting the published bytes.

## Test

```
npm test
```
