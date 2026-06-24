import { canonicalize, type DrawRecord } from './canonical.js';

const GENESIS = 'sha256:' + '0'.repeat(64);

export interface SignedEntry {
  record: DrawRecord;
  entryHash: string;
  keyId: string;
  signature: string; // base64, DER-encoded ECDSA
}

/** Map of keyId to base64 SubjectPublicKeyInfo (X.509 SPKI) of the public key. */
export type PublicKeys = Record<string, string>;

export interface VerifyResult {
  ok: boolean;
  count: number;
  errors: string[];
}

/**
 * Verifies a sequence of signed draw entries: each signature against its public
 * key, each stored hash against the recomputed canonical hash, and the hash
 * chain (prevHash links, contiguous seqNo, unique drawId). Returns all problems
 * found rather than throwing.
 */
export async function verifyLedger(entries: SignedEntry[], keys: PublicKeys): Promise<VerifyResult> {
  const errors: string[] = [];
  const seenDrawIds = new Set<string>();
  const importedKeys = new Map<string, CryptoKey>();
  let prevHash = GENESIS;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const where = `entry ${i} (drawId=${e.record?.drawId})`;

    if (e.record.seqNo !== i) errors.push(`${where}: seqNo ${e.record.seqNo} does not match position ${i}`);
    if (e.record.prevHash !== prevHash) errors.push(`${where}: prevHash does not chain to the previous entry`);
    if (seenDrawIds.has(e.record.drawId)) errors.push(`${where}: duplicate drawId`);
    seenDrawIds.add(e.record.drawId);

    const canonicalBytes = new TextEncoder().encode(canonicalize(e.record));

    const recomputed = 'sha256:' + toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', canonicalBytes)));
    if (recomputed !== e.entryHash) errors.push(`${where}: entryHash does not match the record`);

    const spki = keys[e.keyId];
    if (!spki) {
      errors.push(`${where}: no public key for keyId ${e.keyId}`);
    } else {
      try {
        let key = importedKeys.get(e.keyId);
        if (!key) {
          key = await importPublicKey(spki);
          importedKeys.set(e.keyId, key);
        }
        const rawSig = derToRaw(b64ToBytes(e.signature));
        const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, rawSig, canonicalBytes);
        if (!ok) errors.push(`${where}: signature does not verify`);
      } catch (err) {
        errors.push(`${where}: signature error: ${(err as Error).message}`);
      }
    }

    prevHash = e.entryHash;
  }

  return { ok: errors.length === 0, count: entries.length, errors };
}

function importPublicKey(spkiBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', b64ToBytes(spkiBase64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

/**
 * Converts a DER-encoded ECDSA signature (SEQUENCE of two INTEGERs) to the raw
 * r||s form that Web Crypto expects. For P-256 each component is 32 bytes.
 */
function derToRaw(der: Uint8Array, size = 32): Uint8Array {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error('invalid DER: expected sequence');
  i++; // sequence length (short form for P-256 signatures)
  if (der[i++] !== 0x02) throw new Error('invalid DER: expected integer r');
  const rLen = der[i++];
  const r = der.slice(i, i + rLen);
  i += rLen;
  if (der[i++] !== 0x02) throw new Error('invalid DER: expected integer s');
  const sLen = der[i++];
  const s = der.slice(i, i + sLen);

  const out = new Uint8Array(size * 2);
  out.set(fixed(r, size), 0);
  out.set(fixed(s, size), size);
  return out;
}

function fixed(x: Uint8Array, size: number): Uint8Array {
  let start = 0;
  while (start < x.length - 1 && x[start] === 0) start++; // strip leading zeros
  const v = x.slice(start);
  if (v.length > size) throw new Error('integer too large for the curve');
  const out = new Uint8Array(size);
  out.set(v, size - v.length);
  return out;
}
