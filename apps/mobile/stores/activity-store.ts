import { create } from 'zustand';
import type { LocationObject } from 'expo-location';
import type { ActivityType } from '@/types/api';
import { traceDistance } from '@/lib/distance';
import {
  getPendingActivity,
  readBufferedTrace,
  readSession,
  effectiveDurationMs,
  clearBuffer,
  clearSession,
} from '@/db/trace-buffer';
import {
  startTracking,
  stopTracking,
  pauseTracking,
  resumeTracking,
  continueTracking,
  type StartResult,
} from '@/lib/location';

type TracePoint = { lng: number; lat: number; ts: number; accuracy: number; altitude: number | null };

// Speed below this (m/s) means the GPS course-over-ground is too noisy to trust
// for camera rotation. Tuned per activity — real walking pace hovers 0.8–1.2 m/s,
// so 1.0 would flicker on/off for slower walkers.
const MIN_SPEED_MPS_BY_TYPE: Record<ActivityType, number> = {
  walk:  0.7,
  hike:  0.7,
  run:   1.5,
  cycle: 2.5,
};

type ActivityState = {
  isRecording: boolean;
  isPaused: boolean;
  hasPending: boolean;
  // Set when the active session was created in a previous app launch and we
  // restored it on `loadPending`. Lets the UI surface a "recording in
  // background — open notification to control" affordance.
  isBackgroundResumed: boolean;
  type: ActivityType;
  localId: string | null;
  startedAt: Date | null;
  points: TracePoint[];
  distanceM: number;
  durationS: number;
  latestHeading: number | null;
  latestSpeed: number | null;
  start: (type: ActivityType) => Promise<StartResult>;
  continuePending: () => Promise<StartResult>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  // Called by the background GPS task when the app is foreground. Mirrors
  // SQLite writes into the in-memory state the UI consumes.
  ingestForegroundFix: (loc: LocationObject) => void;
  reset: () => void;
  loadPending: () => Promise<void>;
  // Pull live state from SQLite — used on AppState 'active' to catch up after
  // a stretch of background recording, and from controller ops as a single
  // refresh path.
  syncFromSession: () => void;
};

export const useActivityStore = create<ActivityState>((set, get) => ({
  isRecording: false,
  isPaused: false,
  hasPending: false,
  isBackgroundResumed: false,
  type: 'run',
  localId: null,
  startedAt: null,
  points: [],
  distanceM: 0,
  durationS: 0,
  latestHeading: null,
  latestSpeed: null,

  start: async (type) => {
    const localId = Date.now().toString();
    const startedAtMs = Date.now();
    const result = await startTracking(type, { localId, startedAtMs });
    if (!result.ok) return result;
    set({
      isRecording: true,
      isPaused: false,
      hasPending: false,
      isBackgroundResumed: false,
      type,
      localId,
      startedAt: new Date(startedAtMs),
      points: [],
      distanceM: 0,
      durationS: 0,
      latestHeading: null,
      latestSpeed: null,
    });
    return result;
  },

  continuePending: async () => {
    const { localId } = get();
    if (!localId) return { ok: false, reason: 'already_running' };
    const result = await continueTracking(localId);
    if (result.ok) {
      set({
        isRecording: true,
        isPaused: false,
        hasPending: false,
        isBackgroundResumed: false,
      });
    }
    return result;
  },

  pause: async () => {
    const { localId } = get();
    if (!localId) return;
    await pauseTracking(localId);
    set({ isPaused: true });
  },

  // Clear cached heading on resume — the bearing from before the pause is stale
  // by the time recording continues; force a fresh acquisition.
  resume: async () => {
    const { localId } = get();
    if (!localId) return;
    await resumeTracking(localId);
    set({ isPaused: false, latestHeading: null, latestSpeed: null });
  },

  stop: async () => {
    const { localId } = get();
    if (!localId) return;
    await stopTracking(localId);
    set({ isRecording: false, isPaused: false, isBackgroundResumed: false });
  },

  ingestForegroundFix: (loc) => {
    const s = get();
    if (!s.isRecording || s.isPaused || !s.localId) return;
    const point: TracePoint = {
      lng: loc.coords.longitude,
      lat: loc.coords.latitude,
      ts: loc.timestamp,
      accuracy: loc.coords.accuracy ?? 999,
      altitude: loc.coords.altitude ?? null,
    };
    const newPoints = [...s.points, point];
    const durationDelta =
      newPoints.length > 1
        ? (point.ts - s.points[s.points.length - 1].ts) / 1000
        : 0;
    // Gate heading on speed — below the threshold, GPS course-over-ground flips
    // wildly between fixes. Android can return 0 as a placeholder valid-looking
    // heading; speed is the real liveness signal.
    const speed = loc.coords.speed ?? -1;
    const heading = loc.coords.heading ?? -1;
    const headingFresh = speed >= MIN_SPEED_MPS_BY_TYPE[s.type] && heading >= 0;
    set({
      points: newPoints,
      distanceM: traceDistance(newPoints),
      durationS: s.durationS + durationDelta,
      ...(headingFresh ? { latestHeading: heading, latestSpeed: speed } : {}),
    });
  },

  reset: () => {
    const { localId } = get();
    if (localId) {
      clearBuffer(localId);
      clearSession(localId);
    }
    set({
      isRecording: false,
      isPaused: false,
      hasPending: false,
      isBackgroundResumed: false,
      points: [],
      startedAt: null,
      localId: null,
      distanceM: 0,
      durationS: 0,
      latestHeading: null,
      latestSpeed: null,
    });
  },

  loadPending: async () => {
    const pending = getPendingActivity();
    if (!pending) return;
    const points = readBufferedTrace(pending.local_id);
    if (!points.length) {
      // Buffered points were cleared but the pending row lingered. Nuke both.
      clearBuffer(pending.local_id);
      clearSession(pending.local_id);
      return;
    }
    const session = readSession(pending.local_id);
    const distanceM = session?.total_distance_m ?? traceDistance(points);
    const durationS = session
      ? Math.floor(effectiveDurationMs(session, Date.now()) / 1000)
      : points.length > 1
        ? (points[points.length - 1].ts - points[0].ts) / 1000
        : 0;
    set({
      isRecording: false,
      isPaused: session?.state === 'paused',
      hasPending: true,
      isBackgroundResumed: !!session && session.state !== 'stopped',
      type: pending.type as ActivityType,
      localId: pending.local_id,
      startedAt: new Date(pending.started_at),
      points,
      distanceM,
      durationS,
    });
  },

  syncFromSession: () => {
    const { localId } = get();
    if (!localId) return;
    const session = readSession(localId);
    if (!session) return;
    const points = readBufferedTrace(localId);
    const distanceM = session.total_distance_m;
    const durationS = Math.floor(effectiveDurationMs(session, Date.now()) / 1000);
    set({
      isRecording: session.state !== 'stopped',
      isPaused:    session.state === 'paused',
      points,
      distanceM,
      durationS,
      // Reset heading — if we were backgrounded, it's stale by now.
      latestHeading: null,
      latestSpeed: null,
    });
  },
}));
