/**
 * Live foreground-service notification for activity recording on Android.
 *
 * Why this exists: expo-location's built-in foreground service notification is
 * static — once started, its title/body never change. We need a notification
 * that updates ~1 Hz with distance/time/pace and carries Pause/Resume/Stop
 * action buttons that work even after the app is killed. Notifee gives us
 * full control of the FGS notification and reliable headless event delivery.
 *
 * Module side effects (run at import time):
 *   1. Registers the foreground-service runner (must happen once before
 *      `displayNotification({ asForegroundService: true })`).
 *   2. Wires Notifee's background + foreground event handlers so action-button
 *      taps reach the recording controller even when the app is force-killed.
 *
 * MUST be imported (for side effects) from `app/_layout.tsx`.
 */
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
  type Event,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import {
  readSession,
  effectiveDurationMs,
  type SessionRow,
} from '@/db/trace-buffer';

const CHANNEL_ID = 'recording';
const CHANNEL_NAME = 'Activity recording';
const NOTIFICATION_ID = 'ilaaka-recording';
const STOPPED_FOLLOWUP_ID = 'ilaaka-recording-saved';

// Module-level cache so we don't pay the channel-existence check on every fix.
let channelEnsured = false;

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelEnsured) return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: CHANNEL_NAME,
    importance: AndroidImportance.LOW,
    visibility: AndroidVisibility.PUBLIC,
    sound: undefined,
    vibration: false,
  });
  channelEnsured = true;
}

function formatDurationMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPace(distanceM: number, durationMs: number): string | null {
  if (distanceM < 10 || durationMs < 1000) return null;
  const minPerKm = durationMs / 60_000 / (distanceM / 1000);
  if (!isFinite(minPerKm) || minPerKm <= 0 || minPerKm > 60) return null;
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, '0')}/km`;
}

function renderTitle(session: SessionRow): string {
  const km = (session.total_distance_m / 1000).toFixed(2);
  if (session.last_error === 'permission_revoked') return `Ilaaka • ${km} km`;
  if (session.last_error === 'storage_full') return `Ilaaka • ${km} km`;
  if (session.state === 'paused') return `Ilaaka • Paused`;
  return `Ilaaka • ${km} km`;
}

function renderBody(session: SessionRow, now: number): string {
  if (session.last_error === 'permission_revoked') {
    return 'Paused — location access lost. Tap to fix.';
  }
  if (session.last_error === 'storage_full') {
    return 'Paused — phone storage is full.';
  }
  const durationMs = effectiveDurationMs(session, now);
  const dur = formatDurationMs(durationMs);
  const pace = formatPace(session.total_distance_m, durationMs);
  if (session.state === 'paused') {
    return `${(session.total_distance_m / 1000).toFixed(2)} km · ${dur}`;
  }
  return pace ? `${dur} · ${pace}` : dur;
}

function actionsForState(session: SessionRow) {
  // Stop is always available; pause/resume swap based on state.
  if (session.state === 'paused') {
    return [
      { title: 'Resume', pressAction: { id: 'resume' } },
      { title: 'Stop',   pressAction: { id: 'stop' } },
    ];
  }
  return [
    { title: 'Pause', pressAction: { id: 'pause' } },
    { title: 'Stop',  pressAction: { id: 'stop' } },
  ];
}

/**
 * Start (or refresh) the foreground-service notification for an active session.
 * Safe to call multiple times — Notifee dedups on `id`, so this becomes an
 * in-place update once the FGS is already running.
 */
export async function startRecordingForegroundService(localId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await ensureChannel();
  const session = readSession(localId);
  if (!session) return;

  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: renderTitle(session),
    body:  renderBody(session, Date.now()),
    data:  { kind: 'recording', localId },
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      autoCancel: false,
      smallIcon: 'notification_icon',
      colorized: true,
      color: '#7F77DD',
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: actionsForState(session),
      onlyAlertOnce: true,
    },
  });
}

/**
 * Re-render the notification body from the latest SQLite session row. Called
 * from the background task on every GPS fix and from the controller after
 * pause/resume.
 */
export async function updateRecordingNotification(localId: string): Promise<void> {
  // Delegating to startRecordingForegroundService — Notifee treats same-id
  // displayNotification as an in-place update. With LOW importance + ongoing,
  // there's no sound or vibration on each refresh.
  await startRecordingForegroundService(localId);
}

/**
 * Tear down the foreground service and dismiss the live notification. Then
 * optionally surface a one-shot reminder that the run is saved locally and
 * needs the app to publish.
 */
export async function stopRecordingForegroundService(opts?: { showSavedFollowup?: boolean }): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.stopForegroundService();
  } catch {
    // Notifee throws if the service isn't running. Safe to ignore.
  }
  try {
    await notifee.cancelNotification(NOTIFICATION_ID);
  } catch {/* nothing to dismiss */}

  if (opts?.showSavedFollowup) {
    await ensureChannel();
    await notifee.displayNotification({
      id: STOPPED_FOLLOWUP_ID,
      title: 'Run saved locally',
      body:  'Open Ilaaka to publish or discard.',
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'notification_icon',
        pressAction: { id: 'default', launchActivity: 'default' },
        autoCancel: true,
      },
    });
  }
}

// ── Event wiring ────────────────────────────────────────────────────────────
// Both foreground (app visible) and background (app suspended / killed)
// notification taps need to reach the controller. Notifee requires the
// foreground-service runner to be registered at top level before any
// `asForegroundService` notification is shown.

// `registerForegroundService` runs in Notifee's headless context on Android.
// The promise we return keeps the service alive until we call
// stopForegroundService; resolving early would tear down the service.
notifee.registerForegroundService(() => {
  return new Promise(() => {
    // Intentionally never resolves. Notifee stops this promise's runtime
    // when we call stopForegroundService(); no cleanup needed here.
  });
});

async function dispatchAction(event: Event): Promise<void> {
  if (event.type !== EventType.ACTION_PRESS) return;
  const actionId = event.detail.pressAction?.id;
  const localId = event.detail.notification?.data?.localId as string | undefined;
  if (!actionId || !localId) return;
  // Lazy import to avoid a circular static dep — the controller imports this
  // module too. By the time a user taps a button, both modules are evaluated.
  const controller = await import('./recording-controller');
  switch (actionId) {
    case 'pause':  await controller.pause(localId);  break;
    case 'resume': await controller.resume(localId); break;
    case 'stop':   await controller.stop(localId, { showSavedFollowup: true }); break;
  }
}

notifee.onBackgroundEvent(dispatchAction);
notifee.onForegroundEvent(dispatchAction);
