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
  create table if not exists recording_session (
    local_id text primary key,
    state text not null,
    total_distance_m real not null default 0,
    last_lng real,
    last_lat real,
    last_fix_ts integer,
    started_at integer not null,
    paused_at integer,
    accumulated_pause_ms integer not null default 0,
    last_error text
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
  db.runSync('delete from recording_session');
}

// ── Recording session ──────────────────────────────────────────────────────
// Source of truth for live recording state shared between the foreground UI,
// the background GPS task, and the notification action handler. All writers
// go through these helpers; no direct SQL elsewhere.

export type SessionState = 'recording' | 'paused' | 'stopped';
export type SessionErrorCode = 'permission_revoked' | 'storage_full';

export type SessionRow = {
  local_id: string;
  state: SessionState;
  total_distance_m: number;
  last_lng: number | null;
  last_lat: number | null;
  last_fix_ts: number | null;
  started_at: number;
  paused_at: number | null;
  accumulated_pause_ms: number;
  last_error: SessionErrorCode | null;
};

export function startSession(localId: string, startedAtMs: number): void {
  db.runSync(
    `insert or replace into recording_session
       (local_id, state, total_distance_m, last_lng, last_lat, last_fix_ts,
        started_at, paused_at, accumulated_pause_ms, last_error)
     values (?, 'recording', 0, null, null, null, ?, null, 0, null)`,
    localId, startedAtMs,
  );
}

export function readSession(localId: string): SessionRow | null {
  return db.getFirstSync<SessionRow>(
    `select local_id, state, total_distance_m, last_lng, last_lat, last_fix_ts,
            started_at, paused_at, accumulated_pause_ms, last_error
       from recording_session where local_id = ?`,
    localId,
  ) ?? null;
}

export function readActiveSession(): SessionRow | null {
  return db.getFirstSync<SessionRow>(
    `select local_id, state, total_distance_m, last_lng, last_lat, last_fix_ts,
            started_at, paused_at, accumulated_pause_ms, last_error
       from recording_session
      where state in ('recording','paused')
      order by started_at desc limit 1`,
  ) ?? null;
}

// Records a new GPS fix on the session: accumulates distance and snapshots
// last_*. Idempotent on repeated ts (the task can sometimes redeliver).
export function updateSessionFix(
  localId: string,
  lng: number,
  lat: number,
  ts: number,
  deltaMeters: number,
): void {
  const current = readSession(localId);
  if (!current) return;
  if (current.last_fix_ts !== null && ts <= current.last_fix_ts) return;
  db.runSync(
    `update recording_session
        set total_distance_m = total_distance_m + ?,
            last_lng = ?, last_lat = ?, last_fix_ts = ?
      where local_id = ?`,
    deltaMeters, lng, lat, ts, localId,
  );
}

export function pauseSession(localId: string, pausedAtMs: number): void {
  const current = readSession(localId);
  if (!current || current.state !== 'recording') return;
  db.runSync(
    `update recording_session set state = 'paused', paused_at = ? where local_id = ?`,
    pausedAtMs, localId,
  );
}

export function resumeSession(localId: string, resumedAtMs: number): void {
  const current = readSession(localId);
  if (!current || current.state !== 'paused' || current.paused_at == null) return;
  const pauseDelta = Math.max(0, resumedAtMs - current.paused_at);
  db.runSync(
    `update recording_session
        set state = 'recording',
            paused_at = null,
            accumulated_pause_ms = accumulated_pause_ms + ?,
            last_error = null
      where local_id = ?`,
    pauseDelta, localId,
  );
}

export function stopSession(localId: string): void {
  db.runSync(
    `update recording_session set state = 'stopped', paused_at = null where local_id = ?`,
    localId,
  );
}

export function clearSession(localId: string): void {
  db.runSync('delete from recording_session where local_id = ?', localId);
}

export function markSessionError(localId: string, code: SessionErrorCode): void {
  db.runSync(
    `update recording_session
        set last_error = ?,
            state = case when state = 'recording' then 'paused' else state end,
            paused_at = case when state = 'recording' then ? else paused_at end
      where local_id = ?`,
    code, Date.now(), localId,
  );
}

// Effective recorded time, in ms — wall clock minus accumulated pauses minus
// the current in-progress pause (if any).
export function effectiveDurationMs(s: SessionRow, nowMs: number): number {
  const wall = nowMs - s.started_at;
  const ongoingPause = s.paused_at != null ? Math.max(0, nowMs - s.paused_at) : 0;
  return Math.max(0, wall - s.accumulated_pause_ms - ongoingPause);
}
