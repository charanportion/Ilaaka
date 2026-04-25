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

export function bufferPoint(
  localId: string,
  seq: number,
  p: { lng: number; lat: number; ts: number; accuracy: number },
) {
  db.runSync(
    'insert or replace into trace_buffer values (?, ?, ?, ?, ?, ?)',
    localId, seq, p.lng, p.lat, p.ts, p.accuracy,
  );
}

export function readBufferedTrace(localId: string) {
  return db.getAllSync<{ lng: number; lat: number; ts: number; accuracy: number }>(
    'select lng, lat, ts, accuracy from trace_buffer where activity_local_id = ? order by seq',
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
