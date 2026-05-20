/**
 * Idempotent start/pause/resume/stop for activity recording.
 *
 * This is the single point of entry for every recording state change. The UI
 * (record.tsx via the Zustand store) and the notification action handler
 * (recording-notification.ts) both call into here. State lives in SQLite — we
 * never assume the Zustand store is initialized, because notification taps run
 * in a headless JS context when the app is killed.
 *
 * Every public op reads the session row first and no-ops when the operation
 * doesn't apply, so rapid taps from the notification (double-stop, etc.) are
 * safe.
 */
import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  createPendingActivity,
  endPendingActivity,
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  readSession,
  readActiveSession,
  markSessionError,
} from '@/db/trace-buffer';
import {
  startRecordingForegroundService,
  updateRecordingNotification,
  stopRecordingForegroundService,
} from '@/lib/recording-notification';
import { RECORDING_TASK_NAME } from '@/lib/recording-task';
import type { ActivityType } from '@/types/api';

const BATTERY_PROMPT_KEY = 'ilaaka.battery_opt_prompted';

export type StartResult =
  | { ok: true; localId: string }
  | { ok: false; reason: 'foreground_denied' | 'background_denied' | 'already_running' };

/**
 * Start a new recording. Creates the pending activity + session rows, requests
 * foreground + background location permissions, starts the FGS notification,
 * and registers the location-updates task.
 */
export async function start(
  type: ActivityType,
  opts: { localId: string; startedAtMs: number },
): Promise<StartResult> {
  const { localId, startedAtMs } = opts;

  // Refuse to double-start. The task may already be running from a previous
  // launch that we haven't synced into the UI yet.
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK_NAME)) {
    return { ok: false, reason: 'already_running' };
  }

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'foreground_denied' };

  // Background permission is what lets us keep tracking when the app is in
  // the background or killed. Without it, Android throttles to nothing.
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return { ok: false, reason: 'background_denied' };

  createPendingActivity(localId, type, startedAtMs);
  startSession(localId, startedAtMs);

  await startRecordingForegroundService(localId);

  await Location.startLocationUpdatesAsync(RECORDING_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    // No foregroundService option — Notifee owns the FGS notification.
  });

  // Battery-optimization prompt is asked once, ever. If aggressive OEM Doze
  // kills the process, the user wouldn't get a second chance otherwise.
  void maybePromptBatteryOptimization();

  return { ok: true, localId };
}

async function maybePromptBatteryOptimization(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const prompted = await SecureStore.getItemAsync(BATTERY_PROMPT_KEY);
    if (prompted === '1') return;
    const notifee = (await import('@notifee/react-native')).default;
    const enabled = await notifee.isBatteryOptimizationEnabled();
    if (enabled) {
      await notifee.openBatteryOptimizationSettings();
    }
    await SecureStore.setItemAsync(BATTERY_PROMPT_KEY, '1');
  } catch {
    // Battery-optimization opt-out is best-effort. Failing here doesn't break
    // recording — just means the user might get killed by Doze on some OEMs.
  }
}

/**
 * Re-attach to a session that survived an app kill. The pending row + buffered
 * points are still in SQLite; we rebuild the notification, restart the GPS
 * task if it isn't already running, and flip the session back to 'recording'
 * if it was paused-by-relaunch.
 */
export async function continueExisting(localId: string): Promise<StartResult> {
  const session = readSession(localId);
  if (!session || session.state === 'stopped') {
    return { ok: false, reason: 'already_running' };
  }

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'foreground_denied' };
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return { ok: false, reason: 'background_denied' };

  await startRecordingForegroundService(localId);

  if (!(await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK_NAME))) {
    await Location.startLocationUpdatesAsync(RECORDING_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
  }

  if (session.state === 'paused') {
    resumeSession(localId, Date.now());
    await updateRecordingNotification(localId);
  }
  if (AppState.currentState === 'active') {
    await syncStoreFromSession();
  }
  return { ok: true, localId };
}

export async function pause(localId: string): Promise<void> {
  const session = readSession(localId);
  if (!session || session.state !== 'recording') return;
  pauseSession(localId, Date.now());
  await updateRecordingNotification(localId);
  if (AppState.currentState === 'active') {
    await syncStoreFromSession();
  }
}

export async function resume(localId: string): Promise<void> {
  const session = readSession(localId);
  if (!session || session.state !== 'paused') return;
  resumeSession(localId, Date.now());
  await updateRecordingNotification(localId);
  if (AppState.currentState === 'active') {
    await syncStoreFromSession();
  }
}

export async function stop(
  localId: string,
  opts?: { showSavedFollowup?: boolean },
): Promise<void> {
  const session = readSession(localId);
  if (!session || session.state === 'stopped') return;

  stopSession(localId);
  endPendingActivity(localId, Date.now());

  // Order matters: stop GPS updates first so we don't get a final fix queued
  // against a stopped session; then tear down the notification.
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(RECORDING_TASK_NAME);
  }
  await stopRecordingForegroundService({ showSavedFollowup: !!opts?.showSavedFollowup });

  if (AppState.currentState === 'active') {
    await syncStoreFromSession();
  }
}

/**
 * Called by the task handler when location permission is revoked or another
 * unrecoverable error fires on the updates stream. Pauses the session so the
 * notification flips to the error UI; the user can resolve and resume.
 */
export async function reportTaskError(
  localId: string,
  code: 'permission_revoked' | 'storage_full',
): Promise<void> {
  markSessionError(localId, code);
  await updateRecordingNotification(localId);
  if (AppState.currentState === 'active') {
    await syncStoreFromSession();
  }
}

/**
 * Look up the active session row (if any) and push it into the Zustand store
 * so the UI reflects current background state. Lazy-imported to avoid a
 * static cycle with the store (which delegates back into this controller).
 */
async function syncStoreFromSession(): Promise<void> {
  try {
    const mod = await import('@/stores/activity-store');
    mod.useActivityStore.getState().syncFromSession();
  } catch {
    // Store may not be initialized yet (e.g. in a headless notification-tap
    // context). SQLite is the source of truth; the UI will catch up on next
    // foreground mount.
  }
}

/**
 * Cleanly recover state when the app is launched (or re-launched) and may or
 * may not have an in-flight recording. Returns the active session if one
 * exists, so the UI can choose whether to surface a "Continue Activity" card
 * or jump straight back into the recorder.
 */
export async function reconcileOnLaunch(): Promise<{ active: boolean; localId: string | null }> {
  const session = readActiveSession();
  if (!session) {
    // Defensive: if no session row but the task is somehow still running
    // (e.g. SQLite was cleared by sign-out), stop it.
    if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(RECORDING_TASK_NAME).catch(() => {});
    }
    await stopRecordingForegroundService().catch(() => {});
    return { active: false, localId: null };
  }
  // If session is recording but task isn't, the OS probably killed us. The
  // notification's gone too. Treat the session as paused so the user has a
  // clear "Continue" affordance.
  const taskRunning = await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK_NAME);
  if (session.state === 'recording' && !taskRunning) {
    pauseSession(session.local_id, Date.now());
  }
  return { active: true, localId: session.local_id };
}
