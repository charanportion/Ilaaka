/**
 * Background GPS task for activity recording.
 *
 * Registered at module top level so `TaskManager.defineTask` runs during JS
 * bootstrap — required for Android to dispatch headless location callbacks
 * after a swipe-kill / process restart. Must be imported (side-effect only)
 * from `app/_layout.tsx`.
 *
 * The task never touches the Zustand store. It writes to SQLite and updates
 * the notification. The foreground branch (only when AppState === 'active')
 * additionally projects fresh state into the store so the UI updates live.
 */
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import {
  bufferPoint,
  readBufferedTrace,
  readActiveSession,
  readSession,
  updateSessionFix,
} from '@/db/trace-buffer';

export const RECORDING_TASK_NAME = 'ilaaka-recording-task';

const EARTH_R = 6_371_000;

function haversineMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

type TaskPayload = {
  data?: { locations?: Location.LocationObject[] };
  error?: TaskManager.TaskManagerError | null;
};

TaskManager.defineTask(RECORDING_TASK_NAME, async (payload: TaskPayload) => {
  try {
    const session = readActiveSession();
    if (!session) {
      // No active session means we shouldn't be running. Stop gracefully —
      // protects against zombie tasks after sign-out or app data clear.
      try {
        if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK_NAME)) {
          await Location.stopLocationUpdatesAsync(RECORDING_TASK_NAME);
        }
      } catch {/* nothing to stop */}
      return;
    }

    if (payload.error) {
      // expo-location surfaces permission revocation here on Android.
      const code = payload.error.message?.toLowerCase().includes('permission')
        ? 'permission_revoked'
        : 'permission_revoked';
      const controller = await import('@/lib/recording-controller');
      await controller.reportTaskError(session.local_id, code);
      return;
    }

    const locations = payload.data?.locations;
    if (!locations || locations.length === 0) return;

    // The session may have been paused (from notification action) between the
    // fix being captured and us getting here — re-read inside the loop.
    let lastLng = session.last_lng;
    let lastLat = session.last_lat;
    let lastTs = session.last_fix_ts;
    let nextSeq: number | null = null;

    for (const loc of locations) {
      const live = readSession(session.local_id);
      if (!live || live.state !== 'recording') return;

      const lng = loc.coords.longitude;
      const lat = loc.coords.latitude;
      const ts = loc.timestamp;

      // Drop fixes older than the last recorded one — TaskManager occasionally
      // redelivers batched updates after a wake.
      if (lastTs !== null && ts <= lastTs) continue;

      const delta =
        lastLng !== null && lastLat !== null
          ? haversineMeters(lastLng, lastLat, lng, lat)
          : 0;

      try {
        // bufferPoint is `insert or replace` keyed on (local_id, seq). We need
        // a monotonic seq — count existing rows on first iteration, then
        // increment locally.
        if (nextSeq === null) {
          nextSeq = readBufferedTrace(session.local_id).length;
        }
        bufferPoint(session.local_id, nextSeq, {
          lng, lat, ts,
          accuracy: loc.coords.accuracy ?? 999,
          altitude: loc.coords.altitude ?? null,
        });
        nextSeq += 1;
        updateSessionFix(session.local_id, lng, lat, ts, delta);
      } catch (e) {
        // SQLite write failure most commonly means storage_full. Surface it.
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('disk') || msg.toLowerCase().includes('full')) {
          const controller = await import('@/lib/recording-controller');
          await controller.reportTaskError(session.local_id, 'storage_full');
          return;
        }
        throw e;
      }

      lastLng = lng;
      lastLat = lat;
      lastTs = ts;

      // When the app is foreground, push the new point into Zustand too so the
      // UI redraws. When backgrounded, we only update SQLite + notification.
      if (AppState.currentState === 'active') {
        try {
          const storeMod = await import('@/stores/activity-store');
          storeMod.useActivityStore.getState().ingestForegroundFix(loc);
        } catch {/* store not ready yet */}
      }
    }

    // Re-render the notification once per task invocation (a single batch may
    // contain multiple locations on iOS / when the device is waking from sleep).
    const notifMod = await import('@/lib/recording-notification');
    await notifMod.updateRecordingNotification(session.local_id);
  } catch (err) {
    // Last-ditch: never let an exception kill the task registration. Log to
    // console — Sentry isn't available in headless contexts.
    console.warn('[recording-task] unhandled', err);
  }
});
