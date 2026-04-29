import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('ilaaka.db');

db.execSync(`
  create table if not exists trace_buffer (
    activity_local_id text not null,
    seq integer not null,
    lng real not null,
    lat real not null,
    ts integer not null,
    accuracy real not null,
    primary key (activity_local_id, seq)
  );
  create table if not exists pending_activities (
    local_id text primary key,
    type text not null,
    started_at integer not null,
    ended_at integer,
    submitted integer not null default 0
  );
`);

// Add altitude column for users upgrading from a pre-altitude build.
const traceCols = db.getAllSync<{ name: string }>('pragma table_info(trace_buffer)');
if (!traceCols.some((c) => c.name === 'altitude')) {
  db.execSync('alter table trace_buffer add column altitude real');
}

// Add idempotency_key column for users upgrading from a pre-idempotency build.
// Stable per pending activity so retries on network failure don't double-submit.
const pendingCols = db.getAllSync<{ name: string }>('pragma table_info(pending_activities)');
if (!pendingCols.some((c) => c.name === 'idempotency_key')) {
  db.execSync('alter table pending_activities add column idempotency_key text');
}

function generateUuidV4(): string {
  // Prefer the platform crypto.randomUUID() (available in RN 0.76+ and Hermes).
  // Fall back to a manual v4 builder using Math.random for very old runtimes.
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += hex[(Math.random() * 4) | 8];
    else s += hex[(Math.random() * 16) | 0];
  }
  return s;
}

export function getOrCreateIdempotencyKey(localId: string): string {
  const row = db.getFirstSync<{ idempotency_key: string | null }>(
    'select idempotency_key from pending_activities where local_id = ?',
    localId,
  );
  if (row?.idempotency_key) return row.idempotency_key;
  const key = generateUuidV4();
  db.runSync(
    'update pending_activities set idempotency_key = ? where local_id = ?',
    key, localId,
  );
  return key;
}

export function bufferPoint(
  localId: string,
  seq: number,
  p: { lng: number; lat: number; ts: number; accuracy: number; altitude: number | null },
) {
  db.runSync(
    'insert or replace into trace_buffer (activity_local_id, seq, lng, lat, ts, accuracy, altitude) values (?, ?, ?, ?, ?, ?, ?)',
    localId, seq, p.lng, p.lat, p.ts, p.accuracy, p.altitude,
  );
}

export function readBufferedTrace(localId: string) {
  return db.getAllSync<{ lng: number; lat: number; ts: number; accuracy: number; altitude: number | null }>(
    'select lng, lat, ts, accuracy, altitude from trace_buffer where activity_local_id = ? order by seq',
    localId,
  );
}

export function clearBuffer(localId: string) {
  db.runSync('delete from trace_buffer where activity_local_id = ?', localId);
  db.runSync('delete from pending_activities where local_id = ?', localId);
}

export function createPendingActivity(localId: string, type: string, startedAtMs: number) {
  db.runSync(
    'insert into pending_activities (local_id, type, started_at) values (?, ?, ?)',
    localId, type, startedAtMs,
  );
}

export function endPendingActivity(localId: string, endedAtMs: number) {
  db.runSync(
    'update pending_activities set ended_at = ? where local_id = ?',
    endedAtMs, localId,
  );
}

export function getPendingActivity(): { local_id: string; type: string; started_at: number } | null {
  return db.getFirstSync<{ local_id: string; type: string; started_at: number }>(
    'select local_id, type, started_at from pending_activities where ended_at is null and submitted = 0 order by started_at desc limit 1',
  ) ?? null;
}

export function getEndedAt(localId: string): number | null {
  const row = db.getFirstSync<{ ended_at: number | null }>(
    'select ended_at from pending_activities where local_id = ?',
    localId,
  );
  return row?.ended_at ?? null;
}

export function markPendingSubmitted(localId: string): void {
  db.runSync('update pending_activities set submitted = 1 where local_id = ?', localId);
}

// Wipe every row in the local SQLite buffer. Called on sign-out so the next
// user signing in on the same device doesn't inherit traces / pending activities.
export function clearAllLocalData(): void {
  db.runSync('delete from trace_buffer');
  db.runSync('delete from pending_activities');
}
