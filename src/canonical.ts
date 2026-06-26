export interface Pool {
  min: number;
  max: number;
}

export interface DrawSpec {
  label: string;
  pool: Pool;
  count: number;
  withReplacement: boolean;
  ordered: boolean;
}

export interface GameSpec {
  gameId: string;
  draws: DrawSpec[];
  distinctAcross: string[][];
}

export interface DrawRecord {
  version: string;
  seqNo: number;
  drawId: string;
  eventId: string;
  drawName: string;
  scheduledAt: string;
  closingDate: string;
  gameSpec: GameSpec;
  result: Record<string, number[]>;
  generatedAt: string;
  nonce: string;
  prevHash: string;
}

/**
 * Canonical encoding of a draw record, following the JSON Canonicalization
 * Scheme (RFC 8785) for this fixed structure. It must match the engine's
 * encoding byte for byte; the cross-language conformance test locks that.
 */
export function canonicalize(r: DrawRecord): string {
  return '{'
    + key('closingDate') + str(r.closingDate) + ','
    + key('drawId') + str(r.drawId) + ','
    + key('drawName') + str(r.drawName) + ','
    + key('eventId') + str(r.eventId) + ','
    + key('gameSpec') + gameSpec(r.gameSpec) + ','
    + key('generatedAt') + str(r.generatedAt) + ','
    + key('nonce') + str(r.nonce) + ','
    + key('prevHash') + str(r.prevHash) + ','
    + key('result') + result(r.result) + ','
    + key('scheduledAt') + str(r.scheduledAt) + ','
    + key('seqNo') + int(r.seqNo) + ','
    + key('version') + str(r.version)
    + '}';
}

function gameSpec(g: GameSpec): string {
  return '{'
    + key('distinctAcross') + distinctAcross(g.distinctAcross) + ','
    + key('draws') + draws(g.draws) + ','
    + key('gameId') + str(g.gameId)
    + '}';
}

function draws(ds: DrawSpec[]): string {
  return '[' + ds.map((d) => '{'
    + key('count') + int(d.count) + ','
    + key('label') + str(d.label) + ','
    + key('ordered') + bool(d.ordered) + ','
    + key('pool') + '{' + key('max') + int(d.pool.max) + ',' + key('min') + int(d.pool.min) + '}' + ','
    + key('withReplacement') + bool(d.withReplacement)
    + '}').join(',') + ']';
}

function distinctAcross(groups: string[][]): string {
  return '[' + groups.map((g) => '[' + g.map(str).join(',') + ']').join(',') + ']';
}

function result(res: Record<string, number[]>): string {
  const keys = Object.keys(res).sort();
  return '{' + keys.map((k) => key(k) + '[' + res[k].map(int).join(',') + ']').join(',') + '}';
}

function key(k: string): string {
  return str(k) + ':';
}

function int(n: number): string {
  return String(n);
}

function bool(b: boolean): string {
  return b ? 'true' : 'false';
}

function str(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const ch = s[i];
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (c === 0x08) out += '\\b';
    else if (c === 0x09) out += '\\t';
    else if (c === 0x0a) out += '\\n';
    else if (c === 0x0c) out += '\\f';
    else if (c === 0x0d) out += '\\r';
    else if (c < 0x20) out += '\\u' + c.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + '"';
}
